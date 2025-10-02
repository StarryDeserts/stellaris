module stellaris::package_manager {

    use std::string::String;
    use aptos_std::smart_table;
    use aptos_std::smart_table::SmartTable;
    use aptos_framework::account;
    use aptos_framework::account::SignerCapability;
    use aptos_framework::object;
    use aptos_framework::object::ObjectCore;

    struct PermissionConfig has key {
        signer_cap: SignerCapability,
        addresses: SmartTable<String, address>
    }

    fun init_module(publsiher: &signer) {
        initialize(publsiher);
    }

    public fun is_owner (admin: address) :bool {
        object::is_owner(object::address_to_object<ObjectCore>(@stellaris), admin)
    }

    public fun owner() :address {
        object::owner(object::address_to_object<ObjectCore>(@stellaris))
    }

    public fun get_resource_address() :address {
        let publisher_address = @stellaris;
        account::create_resource_address(&publisher_address, b"PACKAGE_MANAGER_B")
    }

    public(package) fun get_signer() :signer acquires PermissionConfig {
        account::create_signer_with_capability(&borrow_global<PermissionConfig>(get_resource_address()).signer_cap)
    }

    public entry fun initialize(publsiher: &signer) {
        if (is_initialized()) {
            return
        };
        let (signer, signer_cap) = account::create_resource_account(publsiher, b"PACKAGE_MANAGER_B");
        let resource_signer = signer;
        let config = PermissionConfig {
            signer_cap,
            addresses: smart_table::new<String, address>()
        };
        move_to<PermissionConfig>(&resource_signer, config);
    }

    public fun is_initialized() :bool {
        exists<PermissionConfig>(get_resource_address())
    }



}
