module stellaris::token_registry {

    use std::bcs;
    use std::error;
    use std::hash;
    use std::option;
    use std::signer;
    use std::string::String;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, MintRef, BurnRef, FungibleAsset};
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    use stellaris::package_manager::{is_owner, get_resource_address, get_signer};

    use stellaris::utils;
    use stellaris::acl::{has_role, admin_role};

    #[event]
    struct TokenRegistrationWithExpiryEvent has store, drop {
        base_asset_name: String,
        registry_asset_name: String,
        expiry: u64,
    }

    #[event]
    struct TokenMintWithExpiryEvent has store, drop {
        base_asset_name: String,
        token_to_mint_asset_name: String,
        expiry: u64,
        amount: u64
    }

    #[event]
    struct TokenBurnWithExpiryEvent has store, drop {
        base_asset_name: String,
        token_to_burn_asset_name: String,
        expiry: u64,
        amount: u64
    }

    struct Registry has key {
        tokens: SmartTable<String, String>,
        token_datas: SmartTable<String, TokenData> // key -> token name | value -> token 对应的权限（包括铸造权限、销毁权限）
    }

    struct TokenData has store {
        mint_ref: MintRef,
        burn_ref: BurnRef
    }

    fun init_moudle(publisher: &signer) {
        assert!(is_owner(signer::address_of(publisher)), error::not_implemented(10001));
        let registry = Registry {
            tokens: smart_table::new<String, String>(),
            token_datas: smart_table::new<String, TokenData>()
        };
        move_to(&get_signer(), registry);
    }



    public fun register_token_with_expiry(
        admin: &signer,
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        base_asset_name: String,
        token_name: String,
        expiry: u64
    ) acquires Registry {
        // 进行权限检查，只有管理员才能注册新的 token
        assert!(has_role(signer::address_of(admin), admin_role()), error::permission_denied(1));
        let registry = borrow_global_mut<Registry>(get_resource_address());
        // 创建新的对应的 FA 类型的Token 并且生成 mint_ref 和 burn_ref
        let constructor_ref = &object::create_named_object(&get_signer(), *symbol.bytes());
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::none(),
            token_name,
            symbol,
            decimals,
            icon_uri,
            project_uri
        );
        // 生成 PT 或 YT 资产对应的 mint_ref 和 burn_ref
        let expiry_token_mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let expiry_token_burn_ref = fungible_asset::generate_burn_ref(constructor_ref);
        // 将当前 SY 资产的铸币权和销毁权添加到 Registry 中
        let token_datas = registry.token_datas.borrow_mut(token_name);
        token_datas.burn_ref = expiry_token_burn_ref;
        token_datas.mint_ref = expiry_token_mint_ref;
        // 调用内部函数完成注册
        register_token_with_expiry_internal(registry, base_asset_name, token_name, expiry);
    }

    fun register_token_with_expiry_internal(
        registry: &mut Registry,
        base_asset_name: String,
        token_name: String,
        expiry: u64
    )  {
        // 计算唯一的token ID
        let token_id_string = calc_token_id(base_asset_name, expiry);
        // 检查代币是否已经注册，防止重复注册
        assert!(registry.tokens.contains(token_id_string), error::already_exists(2));
        // 将这个映射关系存储到全局对象 Registry 里
        registry.tokens.add(token_id_string, token_name);
        // 发出注册事件
        event::emit(TokenRegistrationWithExpiryEvent{
            base_asset_name,
            registry_asset_name: token_name,
            expiry
        });
    }

    public(package) fun mint_with_expiry(
        amount: u64,
        expiry: u64,
        base_asset_name: String,
        token_name: String,
    ) :FungibleAsset acquires Registry {
        let registry = borrow_global_mut<Registry>(get_resource_address());
        // 检查当前的 token 是否有被注册
        assert!(is_token_bind_with_expiry(registry, base_asset_name, expiry), error::not_found(2));
        // 检查传入的 amount 数是否大于 0
        assert!(amount > 0, error::invalid_argument(3));
        // 发出 mint 事件
        event::emit(TokenMintWithExpiryEvent{
            base_asset_name,
            token_to_mint_asset_name: token_name,
            expiry,
            amount
        });
        // 从全局结构 Registry 中借出对应的 Token 的 Mint_Ref 权限并铸造 amount 数量的 token
        let token_data = registry.token_datas.borrow_mut(token_name);
        fungible_asset::mint(&token_data.mint_ref, amount)
    }

    public(package) fun burn_with_expiry(
        amount: u64,
        user_pt_balance: FungibleAsset,
        expiry: u64,
        base_asset_name: String,
        burn_token_name: String,
    ) acquires Registry {
        let registry = borrow_global_mut<Registry>(get_resource_address());
        // 检查当前的 token 是否有被注册
        assert!(is_token_bind_with_expiry(registry, base_asset_name, expiry), error::not_found(2));
        // 发出 burn 事件
        event::emit(TokenBurnWithExpiryEvent{
            base_asset_name,
            token_to_burn_asset_name: burn_token_name,
            expiry,
            amount
        });
        // 从全局结构 Registry 中借出对应的 Token 的 Burn_Ref 权限并销毁从 user 账户中取出的 amount 数量的 token
        let token_data = registry.token_datas.borrow_mut(burn_token_name);
        fungible_asset::burn(&token_data.burn_ref, user_pt_balance)
    }

    public fun is_token_bind_with_expiry(
        registry: &Registry,
        base_asset_name: String,
        expiry: u64,
    ) :bool {
        if(registry.tokens.contains(calc_token_id(base_asset_name, expiry))) {
            registry.tokens.borrow(calc_token_id(base_asset_name, expiry)) == &base_asset_name
        } else {
            false
        }
    }

    fun calc_token_id(token_name: String, expiry: u64) :String {
        let byte_vec = bcs::to_bytes(&expiry);
        byte_vec.append(bcs::to_bytes(&token_name));
        let hash = hash::sha2_256(byte_vec);
        utils::vector_to_hex_string(hash)
    }

}
