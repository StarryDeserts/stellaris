module stellaris::acl {

    use std::acl::{Self, ACL};
    use std::error;
    use std::signer;
    use aptos_std::smart_table::{Self, SmartTable};
    use stellaris::package_manager::get_resource_address;

    struct ACLManager has key {
        permissions: SmartTable<u8, ACL>
    }

     fun init_module(publisher: &signer) {
         let acl_m = ACLManager {
             permissions: smart_table::new<u8, ACL>()
         };
         acl_m.permissions.add( register_sy_role(), acl::empty());
         acl_m.permissions.add( add_reward_pool_role(), acl::empty());
         acl_m.permissions.add( create_market_role(), acl::empty());
         acl_m.permissions.add( update_config_role(), acl::empty());
         acl_m.permissions.add( admin_role(), acl::empty());
         move_to(
             publisher, acl_m
         )
    }

    fun internal_has_role(
        acl_m: &ACLManager,
        target: address,
        role_sign: u8
    ) :bool {
        assert!(role_sign < 128, error::invalid_argument(1));
        if (acl_m.permissions.contains(role_sign)) {
            let acl = acl_m.permissions.borrow(role_sign);
            return acl.contains(target)
        };
        false
    }

    public fun has_role(
        target: address,
        role_sign: u8
    ) :bool acquires ACLManager {
        assert!(role_sign < 128, error::invalid_argument(1));
        let acl_m = borrow_global<ACLManager>(get_resource_address());
        if (acl_m.permissions.contains(role_sign)) {
            let acl = acl_m.permissions.borrow(role_sign);
            return acl.contains(target)
        };
        false
    }


    public fun add_role(
        admin: &signer,
        target: address,
        role_sign: u8
    ) acquires ACLManager {
        // 检测传入角色是否有效
        assert!(role_sign < 128, error::invalid_argument(1));
        let acl_m = borrow_global_mut<ACLManager>(get_resource_address());
        // 检查当前方法调用者是否有管理员角色
        assert!(internal_has_role(acl_m, signer::address_of(admin), admin_role()), error::permission_denied(2));
        // 检查 target 地址是否已经拥有这个角色
        assert!(!internal_has_role(acl_m, signer::address_of(admin), role_sign), error::already_exists(3));
        // 如果没有，则添加
        let acl = acl_m.permissions.borrow_mut(role_sign);
        if (!acl.contains(target)) {
            acl.add(target)
        };
    }

    /*

    */
    public fun remove_role(
        admin: &signer,
        target: address,
        role_sign: u8
    ) acquires ACLManager {
        // 检测传入角色是否有效
        assert!(role_sign < 128, error::invalid_argument(1));
        let acl_m = borrow_global_mut<ACLManager>(get_resource_address());
        // 检查当前方法调用者是否有管理员角色
        assert!(internal_has_role(acl_m, signer::address_of(admin), admin_role()), error::permission_denied(2));
        // 检查传入的角色是否存在
        assert!(!internal_has_role(acl_m, signer::address_of(admin), role_sign), error::already_exists(3));
        // 检查 target 地址是否拥有当前角色，如果有，则移除
        let acl = acl_m.permissions.borrow_mut(role_sign);
        if (!acl.contains(target)) {
            acl.remove(target)
        };
    }

    // public fun set_roles

    public fun register_sy_role() : u8 {
        1
    }

    public fun add_reward_pool_role() : u8 {
        2
    }

    public fun create_market_role() : u8 {
        3
    }

    public fun update_config_role() : u8 {
        4
    }

    public fun admin_role() : u8 {
        127
    }
}
