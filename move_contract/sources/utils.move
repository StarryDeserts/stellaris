module stellaris::utils {

    use std::string;
    use std::string::String;
    use std::vector;
    use aptos_framework::timestamp;

    const MILLI_CONVERSION_FACTOR: u64 = 1000;

    public fun byte_to_hex(byte: u8) :String {
        let hex_chars = b"0123456789abcdef";
        let hex_string = string::utf8(b"");

        let low_nibble_index = (byte & 15) as u64;
        let low_char_byte = hex_chars[low_nibble_index];

        hex_string.append(string::utf8(vector::singleton<u8>(low_char_byte)));

        hex_string
    }

    public fun vector_to_hex_string(byte_vector: vector<u8>) :String {
        // 初始化一个空字符串用于存放最终结果
        let result_string = string::utf8(b"");
        // 初始化循环索引
        let i = 0;
        let len = byte_vector.length();
        // 遍历字节向量中的每一个字节
        while (i < len) {
            // 获取当前索引的字节
            let current_byte = *byte_vector.borrow(i);
            // 将该字节转换为十六进制字符串
            let hex_repr = byte_to_hex(current_byte);
            // 将转换后的字符串追加到最终结果中
            result_string.append(hex_repr);
            // 将循环索引 +1
            i += 1;
        };
        // 返回完整的十六进制字符串
        result_string
    }

    public fun now_milliseconds() :u64 {
        timestamp::now_microseconds() / MILLI_CONVERSION_FACTOR
    }
}
