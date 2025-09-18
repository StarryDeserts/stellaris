module stellaris::sy {
    use std::signer;
    use std::error;
    use std::option;
    use std::string::String;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleStore, MintRef, create_store, FungibleAsset, BurnRef};
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;
    use stellaris::fixed_point64::{Self, FixedPoint64};
    use stellaris::package_manager::{is_owner, get_signer, get_resource_address};


    use stellaris::acl::{has_role, admin_role};



    #[event]
    struct DepositEvent has store, drop {
        amount_in: u64,
        share_out: u64,
    }
    #[event]
    struct RedeemEvent has store, drop {
        share_in: u64,
        amount_out: u64,
    }

    struct State has key {
        type_table: SmartTable<String, String>, // key -> SY 资产类型的名称(如SY-stAPT) | value -> 其对应资产类型的名称(stAPT)
        underlying_type_table: SmartTable<String, String>, // key -> SY 资产类型的名称(如SY-stAPT) | value -> 该 SY 资产最终代表的、最基础的资产的类型 (例如 APT)
        assests_balance: SmartTable<String, Object<FungibleStore>>, // key -> SY 资产类型的名称(如SY-stAPT) | value -> 对应的实际余额数量
        sy_mint_ref: SmartTable<String, MintRef>, // key -> SY 资产类型的名称(如SY-stAPT) | value -> 该 SY 资产的铸币权
        sy_brun_ref: SmartTable<String, BurnRef>, // key -> SY 资产类型的名称(如SY-stAPT) | value -> 该 SY 资产的销毁权
    }

    fun init_module(publisher: &signer) {
        let state = State {
            type_table: smart_table::new<String, String>(),
            underlying_type_table: smart_table::new<String, String>(),
            assests_balance: smart_table::new<String, Object<FungibleStore>>(),
            sy_mint_ref: smart_table::new<String, MintRef>(),
            sy_brun_ref: smart_table::new<String, BurnRef>(),
        };
        // 向资源账户中写入全局对象
        move_to(&get_signer(), state);
    }

    /// SY 资产的铸造
    public(package) fun mint(
        amount: u64,
        state: &State,
        sy_type_name: String
    ) :FungibleAsset {
        let mint_ref = state.sy_mint_ref.borrow(sy_type_name);
        fungible_asset::mint(mint_ref, amount)
    }


    /// 存款函数
    public entry fun deposit(
        user: &signer,
        amount: u64,
        sy_type_name: String,
        original_type_name: String,
        origin_fa: Object<Metadata>,
    ) acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        // 检查绑定关系是否有效，确保交互的安全性
        assert!(is_sy_bind(state, sy_type_name, original_type_name), error::not_found(4));
        // 检查用户存款数量的 amount 的值，确认其大于 0
        assert!(amount > 0, error::invalid_argument(5));
        // 向用户的地址里提取出对应数量的资产，并存入到协议的金库中
        let user_fa_balance = primary_fungible_store::withdraw(user, origin_fa, amount);
        let origin_assest_store = state.assests_balance.borrow_mut(sy_type_name);
        fungible_asset::deposit(*origin_assest_store, user_fa_balance);
        // 需要发布存款事件
        let deposit_event = DepositEvent {
            amount_in: amount,
            share_out: amount,
        };
        event::emit(deposit_event);
        // 为用户铸造同等数量的 SY 资产 token，并转给它
        let sy_balance = mint(amount, state, sy_type_name);
        primary_fungible_store::deposit(signer::address_of(user), sy_balance);
    }

    /// 赎回函数
    public entry fun redeem(
        user: &signer,
        amount: u64,
        sy_type_name: String,
        original_type_name: String,
        sy_fa: Object<Metadata>,
    ) acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        // 检查绑定关系是否有效，确保交互的安全性
        assert!(is_sy_bind(state, sy_type_name, original_type_name), error::not_found(4));
        // 检查用户想要赎回数量的 amount 的值，确认其大于 0
        assert!(amount > 0, error::invalid_argument(5));
        // 向用户的地址里提取出对应数量的 SY 资产, 并销毁它，然后向金库中拿出同等份额的原始资产
        let sy_balance = primary_fungible_store::withdraw(user, sy_fa, amount);
        // 需要发布赎回事件
        let redeem_event = RedeemEvent {
            share_in: amount,
            amount_out: amount,
        };
        event::emit(redeem_event);
        fungible_asset::burn(state.sy_brun_ref.borrow(sy_type_name), sy_balance);
        let origin_balance_store = state.assests_balance.borrow_mut(sy_type_name);
        let origin_balance = fungible_asset::withdraw(&get_signer(),*origin_balance_store, amount);
        // 将赎回的原始资产归还给用户
        primary_fungible_store::deposit(signer::address_of(user), origin_balance);
    }



    /// 检查一个 fa 类型是否作为 SY 资产被注册过
    public fun is_sy_registered(sy_type_name: String, state: &mut State) :bool {
        state.type_table.contains(sy_type_name)
    }

    /// 检查 SY 资产和其 直接 对应的生息资产之间的绑定关系是否正确(这是进行 depoist 和 redeem 操作之前必要的安全校验)
    public fun is_sy_bind(
        state: &State,
        sy_type_name: String,
        original_type_name: String
    ) :bool {
        if (state.type_table.contains(sy_type_name)) {
            let bind_original_type_name = state.type_table.borrow(sy_type_name);
            &original_type_name == bind_original_type_name
        } else {
            false
        }
    }

    /// 逻辑与is_sy_bind完全相同，但它检查的是underlying_type_table，用于验证 SY 资产和其最根本的底层资产之间的关系
    public fun is_sy_bind_with_underlying_token(
        state: &State,
        sy_type_name: String,
        initial_type_name: String
    ) :bool {
        if (state.underlying_type_table.contains(sy_type_name)) {
            let bind_initial_type_name = state.underlying_type_table.borrow(sy_type_name);
            &initial_type_name == bind_initial_type_name
        } else {
            false
        }
    }

    /// 核心注册函数(无根源资产)
    public entry fun register_sy_with_yield_token(
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        sy_type_name: String,
        original_type_name: String,
    ) acquires State {
        // 调用注册逻辑
        let state = borrow_global_mut<State>(get_resource_address());
        register_sy(&get_signer(), state, sy_type_name, original_type_name);
        // 检查当前 SY 资产是否已经被注册了
        assert!(!state.sy_mint_ref.contains(sy_type_name), error::already_exists(3));
        // 开始创建这个资产所对应的 SY 资产
        let constructor_ref = &object::create_named_object(&get_signer(), *symbol.bytes());
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::none(),
            sy_type_name,
            symbol,
            decimals,
            icon_uri,
            project_uri
        );
        // 生成 SY 资产对应的 mint_ref 和 burn_ref
        let sy_mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let sy_burn_ref = fungible_asset::generate_burn_ref(constructor_ref);
        // 将当前 SY 资产的铸币权和销毁权添加到 State 中
        state.sy_mint_ref.add(sy_type_name, sy_mint_ref);
        state.sy_brun_ref.add(sy_type_name, sy_burn_ref);
        // 检查 assests_balance 中是否有这个 SY 资产
        if (state.assests_balance.contains(sy_type_name)) {
            // 如果没有，初始化出这个 SY 资产的存储空间
            state.assests_balance.add(
                sy_type_name,
                create_store(&object::create_object(get_resource_address()), object::object_from_constructor_ref<Metadata>(constructor_ref))
            )
        }
    }

    // 对 SY 资产的根源性资产进行注册
    public entry fun register_sy_with_underlying_token(
        admin: &signer,
        sy_type_name: String,
        original_type_name: String
    ) acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        register_underlying_token(admin, state, sy_type_name, original_type_name);
    }

    /// 注册直接的映射逻辑
    fun register_sy(
        admin: &signer,
        state: &mut State,
        sy_type_name: String,
        original_type_name: String
    ) {
        // 检查当前方法的调用者是否有管理员角色
        // assert!(has_role( signer::address_of(admin), admin_role()), error::permission_denied(1));
        // 检查当前资产是否已经被注册
        assert!(state.type_table.contains(sy_type_name), error::already_exists(2));
        // 注册直接的资产映射
        state.type_table.add(sy_type_name, original_type_name);
    }

    // 注册根本的映射逻辑
    fun register_underlying_token(
        admin: &signer,
        state: &mut State,
        sy_type_name: String,
        initial_type_name: String
    ) {
        // 检查当前方法的调用者是否有管理员角色
        // assert!(has_role( signer::address_of(admin), admin_role()), error::permission_denied(1));
        // 检查当前资产是否已经被注册
        assert!(state.underlying_type_table.contains(sy_type_name), error::already_exists(3));
        // 注册根本的资产映射
        state.underlying_type_table.add(sy_type_name, initial_type_name);
    }

    /// 安全解绑
    public entry fun remove_sy_binding(
        admin: &signer,
        sy_type_name: String,
    ) acquires State {
        // 检查当前方法的调用者是否有管理员角色
        // assert!(has_role( signer::address_of(admin), admin_role()), error::permission_denied(1));
        // 开始进行解绑操作
        let state = borrow_global_mut<State>(get_resource_address());
        if (state.type_table.contains(sy_type_name)) {
            state.type_table.remove(sy_type_name);
        };
        if (state.underlying_type_table.contains(sy_type_name)) {
            state.underlying_type_table.remove(sy_type_name);
        };
        // MintRef 需要显示的被处理
        state.sy_mint_ref.remove(sy_type_name);
    }

    /// 原始资产 -> SY，向下取整
    public(package) fun asset_to_sy(
        exchange_rate: FixedPoint64,
        asset_amount: FixedPoint64
    ) :FixedPoint64 {
        fixed_point64::div_fp(asset_amount, exchange_rate)
    }

    /// 原始资产 -> SY，向上取整
    public(package) fun asset_to_sy_up(
        exchange_rate: FixedPoint64,
        asset_amount: FixedPoint64
    ) :FixedPoint64 {
        fixed_point64::div_fp(
            fixed_point64::sub_fp(
                fixed_point64::add_fp(
                    fixed_point64::mul_fp(asset_amount, fixed_point64::one()),
                    exchange_rate
                ),
                fixed_point64::from_u128(1)
            ),
            exchange_rate
        )
    }

    /// SY -> 原始资产，向下取整
    public(package) fun sy_to_asset(
        exchange_rate: FixedPoint64,
        asset_amount: FixedPoint64
    ) :FixedPoint64 {
        fixed_point64::mul_fp(exchange_rate, asset_amount)
    }

    /// SY -> 原始资产，向上取整
    public(package) fun sy_to_asset_up(
        exchange_rate: FixedPoint64,
        asset_amount: FixedPoint64
    ) :FixedPoint64 {
        fixed_point64::div_fp(
            fixed_point64::sub_fp(
                fixed_point64::add_fp(
                    fixed_point64::mul_fp(exchange_rate, asset_amount),
                    fixed_point64::one()
                ),
                fixed_point64::from_u128(1)
            ),
            fixed_point64::one()
        )
    }



}