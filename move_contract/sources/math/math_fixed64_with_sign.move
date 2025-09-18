/// Implementation of Signed Math utilities for FixedPoint64WithSign in Move language.
/// Extended from log_exp_math for signed operations.
module stellaris::math_fixed64_with_sign {
    use stellaris::fixed_point64;  // Base unsigned fixed point
    use stellaris::fixed_point64_with_sign;  // Signed fixed point
    use stellaris::fixed_point64_with_sign::FixedPoint64WithSign;  // Signed fixed point Struct
    use stellaris::log_exp_math;  // Base math functions

    // Error codes (extend from base if needed)
    const ERR_DIVIDE_BY_ZERO: u64 = 0;  // From base
    const ERR_NEGATIVE_VALUE: u64 = 5;  // Custom for negative in positive-required ops
    const ERR_EMPTY_VECTOR: u64 = 6;  // For vector ops



    // Standard deviation of a vector of signed values
    public fun std(values: vector<FixedPoint64WithSign>): FixedPoint64WithSign {
        let mean_val = mean(values);
        let sum_sq_diff = fixed_point64_with_sign::zero();
        let len = values.length();
        let i = 0;
        while (i < len) {
            let diff = fixed_point64_with_sign::sub(values[i], mean_val);
            sum_sq_diff = fixed_point64_with_sign::add(sum_sq_diff, pow(diff, 2));
            i += 1;
        };
        sqrt(div_u128(sum_sq_diff, (len as u128)))
    }

    // Exponential function for signed value
    public fun exp(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        let abs_fp = fixed_point64_with_sign::remove_sign(fp);
        let exp_abs = log_exp_math::exp(1, abs_fp);  // Assume sign=1 for positive exp
        let result = fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(exp_abs), true);
        if (!fixed_point64_with_sign::is_positive(fp)) {
            result = div(fixed_point64_with_sign::one(), result);
        };
        result
    }

    // Multiply-divide with signs
    public fun mul_div(a: FixedPoint64WithSign, b: FixedPoint64WithSign, c: FixedPoint64WithSign): FixedPoint64WithSign {
        let pa = fixed_point64_with_sign::is_positive(a);
        let pb = fixed_point64_with_sign::is_positive(b);
        let pc = fixed_point64_with_sign::is_positive(c);
        let positive = (pa == pb) && (pb == pc);  // XOR logic for signs: same as a*b / c sign
        let abs_a = fixed_point64_with_sign::remove_sign(a);
        let abs_b = fixed_point64_with_sign::remove_sign(b);
        let abs_c = fixed_point64_with_sign::remove_sign(c);
        let unsigned_result = fixed_point64::mul_div_fp(abs_a, abs_b, abs_c);  // Assuming mul_div in base math
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(unsigned_result), positive)
    }

    // Power function (base^exponent), assuming base positive, result positive
    public fun pow(base: FixedPoint64WithSign, exponent: u64): FixedPoint64WithSign {
        let abs_base = fixed_point64_with_sign::remove_sign(base);
        let y_fp = fixed_point64::encode(exponent);
        let unsigned_pow = log_exp_math::pow(abs_base, y_fp);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(unsigned_pow), true)
    }

    // Square root, assert positive TODO: 怀疑
    public fun sqrt(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        assert!(fixed_point64_with_sign::is_positive(fp), ERR_NEGATIVE_VALUE);
        let y = fixed_point64_with_sign::get_raw_value(fp);
        let sqrt_scaled = log_exp_math::sqrt((y as u256) << 64);
        fixed_point64_with_sign::create_from_raw_value((sqrt_scaled as u128), true)
    }

    // Division with signs
    public fun div(a: FixedPoint64WithSign, b: FixedPoint64WithSign): FixedPoint64WithSign {
        assert!(fixed_point64_with_sign::get_raw_value(b) != 0, ERR_DIVIDE_BY_ZERO);
        let positive = fixed_point64_with_sign::is_positive(a) == fixed_point64_with_sign::is_positive(b);
        let abs_a = fixed_point64_with_sign::remove_sign(a);
        let abs_b = fixed_point64_with_sign::remove_sign(b);
        let unsigned_div = fixed_point64::div_fp(abs_a, abs_b);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(unsigned_div), positive)
    }

    // Division by u128, sign from a
    public fun div_u128(a: FixedPoint64WithSign, denominator: u128): FixedPoint64WithSign {
        let positive = fixed_point64_with_sign::is_positive(a);
        let abs_a = fixed_point64_with_sign::remove_sign(a);
        let unsigned_div = fixed_point64::div_u128(abs_a, denominator);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(unsigned_div), positive)
    }

    // Natural log, assert positive
    public fun ln(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        assert!(fixed_point64_with_sign::is_positive(fp), ERR_NEGATIVE_VALUE);
        let abs_fp = fixed_point64_with_sign::remove_sign(fp);
        let (sign, ln_abs) = log_exp_math::ln(abs_fp);
        // Adjust based on base ln, but since ln positive, sign is 1, result positive? Wait, ln can be negative if <1
        // But in signed, if ln result negative, need to handle
        // From Sui: sub(ln_plus_32ln2 - 64*ln2)
        // Aptos ln is (sign, result), where sign is for negative log
        let positive = (sign == 1);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(ln_abs), positive)
    }

    // Log2, assert positive
    public fun log2(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        assert!(fixed_point64_with_sign::is_positive(fp), ERR_NEGATIVE_VALUE);
        let abs_fp = fixed_point64_with_sign::remove_sign(fp);
        let (sign, log2_abs) = log_exp_math::log2(abs_fp);
        let positive = (sign == 1);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(log2_abs), positive)
    }

    // Maximum in vector
    public fun maximum(values: vector<FixedPoint64WithSign>): FixedPoint64WithSign {
        assert!(values.length() > 0, ERR_EMPTY_VECTOR);
        let max_val = values[0];
        let i = 1;
        let len = values.length();
        while (i < len) {
            let current = values[i];
            if (fixed_point64_with_sign::greater_or_equal(current, max_val)) {
                max_val = current;
            };
            i += 1;
        };
        max_val
    }

    // Mean of vector
    public fun mean(values: vector<FixedPoint64WithSign>): FixedPoint64WithSign {
        assert!(values.length() > 0, ERR_EMPTY_VECTOR);
        let sum_val = sum(values);
        div_u128(sum_val, (values.length() as u128))
    }

    // Minimum in vector
    public fun minimum(values: vector<FixedPoint64WithSign>): FixedPoint64WithSign {
        assert!(values.length() > 0, ERR_EMPTY_VECTOR);
        let min_val = values[0];
        let i = 1;
        let len = values.length();
        while (i < len) {
            let current = values[i];
            if (fixed_point64_with_sign::less_or_equal(current, min_val)) {
                min_val = current;
            };
            i += 1;
        };
        min_val
    }

    // Multiplication with signs
    public fun mul(a: FixedPoint64WithSign, b: FixedPoint64WithSign): FixedPoint64WithSign {
        let positive = fixed_point64_with_sign::is_positive(a) == fixed_point64_with_sign::is_positive(b);
        let abs_a = fixed_point64_with_sign::remove_sign(a);
        let abs_b = fixed_point64_with_sign::remove_sign(b);
        let unsigned_mul = fixed_point64::mul_fp(abs_a, abs_b);
        fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(unsigned_mul), positive)
    }

    // Sum of vector
    public fun sum(values: vector<FixedPoint64WithSign>): FixedPoint64WithSign {
        let sum_val = fixed_point64_with_sign::zero();
        let i = 0;
        let len = values.length();
        while (i < len) {
            sum_val = fixed_point64_with_sign::add(sum_val, values[i]);
            i += 1;
        };
        sum_val
    }
}