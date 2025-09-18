/// Implementation of Signed FixedPoint u64 in Move language, extended from fixed_point64.
module stellaris::fixed_point64_with_sign {
    use stellaris::fixed_point64;  // Import the unsigned base module

    // Reuse error codes from base module where applicable
    const ERR_MULTIPLY_RESULT_TOO_LARGE: u64 = 3;  // From base, for potential future use
    // Add a custom error for truncate on negative
    const ERR_TRUNCATE_NEGATIVE: u64 = 4;

    const MAX_U128: u256 = 340282366920938463463374607431768211455;

    /// The struct for signed FixedPoint64.
    struct FixedPoint64WithSign has copy, store, drop {
        v: u128,
        positive: bool,
    }

    /// Create from rational with sign.
    public fun create_from_rational(numerator: u128, denominator: u128, positive: bool): FixedPoint64WithSign {
        let unsigned = fixed_point64::fraction_u128(numerator, denominator);
        FixedPoint64WithSign {
            v: fixed_point64::to_u128(unsigned),
            positive,
        }
    }

    /// Create from raw value with sign.
    public fun create_from_raw_value(v: u128, positive: bool): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v,
            positive,
        }
    }

    /// Get raw value (absolute).
    public fun get_raw_value(fp: FixedPoint64WithSign): u128 {
        fp.v
    }

    /// Absolute value as signed (positive=true).
    public fun abs(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v: get_raw_value(fp),
            positive: true,
        }
    }

    /// Absolute value as u128.
    public fun abs_u128(fp: FixedPoint64WithSign): u128 {
        get_raw_value(fp)
    }

    /// Add two signed values, handling signs.
    public fun add(a: FixedPoint64WithSign, b: FixedPoint64WithSign): FixedPoint64WithSign {
        let va = get_raw_value(a);
        let vb = get_raw_value(b);
        let pa = is_positive(a);
        let pb = is_positive(b);
        let result: u256;
        let p_result: bool;

        if (pa && pb) {
            result = (va as u256) + (vb as u256);
            p_result = true;
        } else if (pa && !pb) {
            if (va > vb) {
                result = (va as u256) - (vb as u256);
                p_result = true;
            } else {
                result = (vb as u256) - (va as u256);
                p_result = false;
            }
        } else if (!pa && pb) {
            if (vb > va) {
                result = (vb as u256) - (va as u256);
                p_result = true;
            } else {
                result = (va as u256) - (vb as u256);
                p_result = false;
            }
        } else {  // Both negative
            result = (va as u256) + (vb as u256);
            p_result = false;
        };

        assert!(result <= MAX_U128, ERR_MULTIPLY_RESULT_TOO_LARGE);  // Reuse as overflow error
        create_from_raw_value((result as u128), p_result)
    }

    /// Create from u64 (positive).
    public fun from_uint64(x: u64): FixedPoint64WithSign {
        let unsigned = fixed_point64::encode(x);
        FixedPoint64WithSign {
            v: fixed_point64::to_u128(unsigned),
            positive: true,
        }
    }

    /// Greater or equal (considering signs).
    public fun greater_or_equal(a: FixedPoint64WithSign, b: FixedPoint64WithSign): bool {
        let diff = sub(a, b);
        is_positive(diff) || is_zero(diff)
    }

    /// Greater or equal without considering signs (absolute comparison).
    public fun greater_or_equal_without_sign(a: FixedPoint64WithSign, b: FixedPoint64WithSign): bool {
        a.v >= b.v
    }

    /// Check if equal (value and sign).
    public fun is_equal(a: FixedPoint64WithSign, b: FixedPoint64WithSign): bool {
        a.v == b.v && a.positive == b.positive
    }

    /// Check if positive.
    public fun is_positive(fp: FixedPoint64WithSign): bool {
        fp.positive
    }

    /// Check if zero.
    public fun is_zero(fp: FixedPoint64WithSign): bool {
        fp.v == 0
    }

    /// Less than (considering signs).
    public fun less(a: FixedPoint64WithSign, b: FixedPoint64WithSign): bool {
        is_positive(sub(b, a))
    }

    /// Less or equal (considering signs).
    public fun less_or_equal(a: FixedPoint64WithSign, b: FixedPoint64WithSign): bool {
        let diff = sub(b, a);
        is_positive(diff) || is_zero(diff)
    }

    /// Negate (flip sign).
    public fun neg(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v: fp.v,
            positive: !fp.positive,
        }
    }

    /// One (positive).
    public fun one(): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v: fixed_point64::to_u128(fixed_point64::one()),
            positive: true,
        }
    }

    /// Remove sign, convert to unsigned FixedPoint64.
    public fun remove_sign(fp: FixedPoint64WithSign): fixed_point64::FixedPoint64 {
        fixed_point64::from_u128(get_raw_value(fp))
    }

    /// Revert sign (same as neg).
    public fun revert_sign(fp: FixedPoint64WithSign): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v: get_raw_value(fp),
            positive: !fp.positive,
        }
    }

    /// Subtract (using add and revert).
    public fun sub(a: FixedPoint64WithSign, b: FixedPoint64WithSign): FixedPoint64WithSign {
        add(a, revert_sign(b))
    }

    /// Truncate to u64 (assert positive).
    public fun truncate(fp: FixedPoint64WithSign): u64 {
        assert!(is_positive(fp), ERR_TRUNCATE_NEGATIVE);
        fixed_point64::decode_round_down(remove_sign(fp))
    }

    /// Zero.
    public fun zero(): FixedPoint64WithSign {
        FixedPoint64WithSign {
            v: 0,
            positive: true,
        }
    }
}
