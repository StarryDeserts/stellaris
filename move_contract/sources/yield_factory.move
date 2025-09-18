module stellaris::yield_factory {

    use std::error;
    use std::signer;
    use std::string::String;
    use aptos_std::math64;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::fungible_asset::{FungibleStore, Metadata, FungibleAsset};
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;

    use stellaris::fixed_point64::{Self, FixedPoint64};
    use stellaris::py_position;
    use stellaris::package_manager::{get_resource_address, get_signer};
    use stellaris::sy;
    use stellaris::py_position::PyPosition;
    use stellaris::py::PyState;
    use stellaris::acl;
    use stellaris::py;
    use stellaris::utils;


    struct YieldFactoryConfig has key {
        interest_fee_rate: FixedPoint64,
        expiry_divisor: u64,
        treasury: address,
        vault: SmartTable<address, Object<FungibleStore>>// key -> SY 资产类型的 Metadata Address | value -> 该 SY 资产的 vault
    }

    #[event]
    struct PYCreationEvent has store, drop {
        expiry: u64
    }

    #[event]
    struct ConfigUpdateEvent has store, drop {
        interest_rate: FixedPoint64,
        expiry_divisor: u64,
        treasury: address,
    }

    #[event]
    struct MintPyEvent has store, drop {
        py_state_address: address,
        share_in: u64,
        amount_pt: u64,
        amount_yt: u64,
        expiry: u64,
    }

    #[event]
    struct RedeemPyEvent has store, drop {
        py_state_address: address,
        amount_pt: u64,
        amount_yt: u64,
        amount_to_redeem: u64,
        share_out: u64,
        expiry: u64
    }

    #[event]
    struct FeeCollectedEvent has store, drop {
        amount: u64,
        treasury: address,
    }

    fun init_module(publisher: &signer) {
        // 初始化 YieldFactoryConfig 结构体
        let config = YieldFactoryConfig {
            // 设置利息费率为 5%
            interest_fee_rate: fixed_point64::fraction_u128(1, 20), // 1/20 = 5%
            // 设置到期日除数为一天的毫秒数，强制到期日按天对齐
            expiry_divisor: 86400000, // 24 * 60 * 60 * 1000
            // 国库地址，初始可以设置为发布者地址或一个专用的多签地址
            treasury: @origin,
            // 初始化一个空的 vault (保险库)
            vault: smart_table::new<address, Object<FungibleStore>>()
        };

        // 将配置作为资源存储在模块发布者的账户下
        move_to(&get_signer(), config);
    }


     /// 负责为一个新的到期日创建一个全新的 PyState 池
    public entry fun create(
        expiry: u64,
        sy_type_name: String,
        sy_metadata_address: Object<Metadata>,
    ) acquires YieldFactoryConfig {
        let config = borrow_global<YieldFactoryConfig>(get_resource_address());
        // 检查到期日是否有效：必须是未来的时间点，并且符合配置中设置的间隔要求
        assert!(
            expiry % config.expiry_divisor == 0 && expiry > utils::now_milliseconds(),
            error::invalid_argument(1)
        );
        // 调用 py 模块的内部函数来实际创建并共享 PyState 对象
        py::create_py(
            expiry,
            sy_type_name,
            sy_metadata_address
        );
        // 发布创建事件
        event::emit(PYCreationEvent{ expiry });
    }

    public(package) fun mint_py_internal(
        sy_balance: FungibleAsset,
        current_index_for_oracle: FixedPoint64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>
    ) :u64 acquires YieldFactoryConfig {
        let config = borrow_global_mut<YieldFactoryConfig>(get_resource_address());
        // 1. 计算能铸造多少 PT/YT
        let amount_to_mint = fixed_point64::decode_round_down(
          sy::sy_to_asset(
              py::current_py_index(py_state_object, current_index_for_oracle),
              fixed_point64::encode(fungible_asset::amount(&sy_balance))
          )
        );
        // 3. 将用户传入的 SY FA 对象存入 PyState 的资金池中
        let user_sy_amount = fungible_asset::amount(&sy_balance);
        py::join_sy(py_state_object, sy_balance);
        // 4. 更新用户的利息记录并计算协议费用
        let protocol_fee = py::update_user_interest(
            config.interest_fee_rate,
            current_index_for_oracle,
            user_py_position,
            py_state_object
        );

        // 5. 将计算出的协议费用存入全局的 vault 中
        deposit_to_vault_internal(
            protocol_fee,
            py_state_object,
            config
        );

        // 6. 为用户实际铸造 PT 和 YT，并更新其个人仓位 `user_py_position`
        py::mint_py(amount_to_mint, amount_to_mint, py_state_object, user_py_position);

        // 7. 发出 MintPyEvent 事件
        event::emit(MintPyEvent{
            py_state_address: object::object_address(&py_state_object),
            share_in: user_sy_amount,
            amount_pt: amount_to_mint,
            amount_yt: amount_to_mint,
            expiry: py_position::expiry(user_py_position),
        });

        // 8. 返回铸造出的 PT/YT 数量
        amount_to_mint
    }

    public(package) fun redeem_py_internal(
        pt_amount_to_redeem: u64, // pt_amount_to_redeem: 用户希望用来赎回的PT数量
        yt_amount_to_redeem: u64, // yt_amount_to_redeem: 用户希望用来赎回的YT数量
        exchange_rate: FixedPoint64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>
    ) :FungibleAsset acquires YieldFactoryConfig {
        let config = borrow_global_mut<YieldFactoryConfig>(get_resource_address());
        // 检查当前是否已到期
        let is_expired = utils::now_milliseconds() > py_position::expiry(user_py_position);
        // 决定实际用于赎回的PT/YT数量
        let amount_to_redeem = if (is_expired) {
            // 如果已到期，用户可以用任意数量的PT来赎回。YT此时已无价值，所以只看PT
            // `set_post_expiry_data`会更新全局状态，记录到期后的最终利息指数
            let protocol_fee = py::set_post_expiry_data(
                config.interest_fee_rate,
                exchange_rate,
                py_state_object
            );
            deposit_to_vault_internal(
                protocol_fee,
                py_state_object,
                config
            );
            pt_amount_to_redeem
        } else {
            // 如果未到期，必须同时提供等量的PT和YT才能赎回。
            // 取两者中的较小值作为实际赎回数量
            math64::min(pt_amount_to_redeem, yt_amount_to_redeem)
        };

        // 1. 销毁用户仓位中的 PT
        py::burn_py(pt_amount_to_redeem, 0, py_state_object, user_py_position);
        // 2. 如果未到期，还需要销毁用户的 YT，并更新利息
        if (!is_expired) {
            // 更新用户利息并收取费用
            let protocol_fee = py::update_user_interest(
                config.interest_fee_rate,
                exchange_rate,
                user_py_position,
                py_state_object
            );
            deposit_to_vault_internal(
                protocol_fee,
                py_state_object,
                config
            );
            // 销毁 YT
            py::burn_py(0, yt_amount_to_redeem, py_state_object, user_py_position);
        };
        // 3. 计算赎回 `amount_to_redeem` 数量的 PT/YT 能得到多少 SY
        let sy_amount_out_fp = sy::asset_to_sy(
            py::current_py_index(py_state_object, exchange_rate),
            fixed_point64::encode(amount_to_redeem)
        );
        // 4. 处理到期后的额外费用（惩罚）
        let penalty_fee_fp = fixed_point64::zero();
        if (is_expired) {
            // 在到期后，协议会收取一笔小的费用，这笔费用是赎回价值与初始价值之间的差额。
            // 这是为了激励用户尽早赎回。
            penalty_fee_fp = fixed_point64::sub_fp(
                sy::asset_to_sy(
                    py::first_py_index(py_state_object),
                    fixed_point64::encode(amount_to_redeem)
                ),
                sy_amount_out_fp
            );
        };
        // 将这部分费用转移到国库
        let penalty_fee_u64 = fixed_point64::decode_round_down(penalty_fee_fp);
        primary_fungible_store::deposit(config.treasury, py::split_sy(penalty_fee_u64, py_state_object));

        // 5. 发出 RedeemPyEvent 和 FeeCollectedEvent 事件
        let sy_amount_out_u64 = fixed_point64::decode_round_down(sy_amount_out_fp);
        event::emit(RedeemPyEvent{
            py_state_address: object::object_address(&py_state_object),
            amount_pt: amount_to_redeem,
            amount_yt: if (is_expired) { 0 } else { amount_to_redeem },
            amount_to_redeem,
            share_out: sy_amount_out_u64,
            expiry: py_position::expiry(user_py_position)
        });
        event::emit(FeeCollectedEvent{
            amount: penalty_fee_u64,
            treasury: config.treasury,
        });

        py::split_sy(sy_amount_out_u64, py_state_object)
    }

    // 将协议费用存入金库保险箱
    fun deposit_to_vault_internal(
        fee_amount: FixedPoint64,
        py_state_object: Object<PyState>,
        config: &mut YieldFactoryConfig
    ) {
        // 1. 检查 vault 中是否已经有该类型的 SY 代币余额
        let sy_metatda = py::sy_metadata_address(py_state_object);
        let sy_address = object::object_address(&sy_metatda);
        if (!config.vault.contains(sy_address)) {
            // 如果没有，则初始化一个该类型的 FungibleStore
            let sy_store = fungible_asset::create_store(&object::create_object(get_resource_address()), sy_metatda);
            config.vault.add(sy_address, sy_store);
        };
        // 2. 检查费用金额是否大于 0
        if (fixed_point64::gt(&fee_amount, &fixed_point64::zero())){
          // 3. 从 PyState 池中分离出费用
            let fee_balance = py::split_sy(fixed_point64::decode_round_up(fee_amount), py_state_object);
            let vault_store = config.vault.borrow_mut(sy_address);
            // 将提取出来的 fee_balance 存入 vault 中
            fungible_asset::deposit(*vault_store, fee_balance);
        };
    }

    public(package) fun deposit_to_vault(
        fee_amount: FixedPoint64,
        py_state_object: Object<PyState>
    ) acquires YieldFactoryConfig {
        // 1. 检查 vault 中是否已经有该类型的 SY 代币余额
        let config = borrow_global_mut<YieldFactoryConfig>(get_resource_address());
        let sy_metatda = py::sy_metadata_address(py_state_object);
        let sy_address = object::object_address(&sy_metatda);
        if (!config.vault.contains(sy_address)) {
            // 如果没有，则初始化一个该类型的 FungibleStore
            let sy_store = fungible_asset::create_store(&object::create_object(get_resource_address()), sy_metatda);
            config.vault.add(sy_address, sy_store);
        };
        // 2. 检查费用金额是否大于 0
        if (fixed_point64::gt(&fee_amount, &fixed_point64::zero())){
            // 3. 从 PyState 池中分离出费用
            let fee_balance = py::split_sy(fixed_point64::decode_round_up(fee_amount), py_state_object);
            let vault_store = config.vault.borrow_mut(sy_address);
            // 将提取出来的 fee_balance 存入 vault 中
            fungible_asset::deposit(*vault_store, fee_balance);
        };
    }

    public(package) fun interest_fee_rate() : FixedPoint64 acquires YieldFactoryConfig {
        let config = borrow_global<YieldFactoryConfig>(get_resource_address());
        config.interest_fee_rate
    }


    public entry fun update_config(
        admin: &signer,
        new_interest_fee_rate_raw: u128,
        // 新的到期日除数
        new_expiry_divisor: u64,
        // 新的金库地址
        new_treasury_address: address,
    ) acquires YieldFactoryConfig {
        // 只有管理员可以调用此函数
        assert!(acl::has_role(signer::address_of(admin), acl::admin_role()), error::not_implemented(1));
        // 1. 处理新的利息费率
        let new_interest_fee_rate = fixed_point64::from_u128(new_interest_fee_rate_raw);
        // 进行安全检查(费率不能过高)
        let fee_rate = &fixed_point64::fraction(1 as u64, 5 as u64);
        assert!(fixed_point64::lte(&new_interest_fee_rate, fee_rate), error::aborted(2));
        let config = borrow_global_mut<YieldFactoryConfig>(get_resource_address());
        config.interest_fee_rate = new_interest_fee_rate;

        // 2. 处理新的到期日除数
        // 安全检查：除数不能为0
        assert!(new_expiry_divisor > 0, error::invalid_argument(3));
        config.expiry_divisor = new_expiry_divisor;

        // 发出配置更新事件
        event::emit(ConfigUpdateEvent{
            interest_rate: new_interest_fee_rate,
            expiry_divisor: new_expiry_divisor,
            treasury: new_treasury_address,
        });
    }
}
