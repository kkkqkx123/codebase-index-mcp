# 业务逻辑漏洞测试文件

# 应该触发 missing-input-validation 规则
def process_payment(amount):
    # 没有输入验证
    return process_transaction(amount)

# 应该触发 business-logic-bypass 规则
def apply_discount(price, user_type):
    if price > 0:  # 简单的正数检查，没有上限验证
        return price * 0.9
    return price

# 应该触发 mass-assignment-vulnerability 规则
def create_user(request_data):
    user = User(**request_data)  # 批量赋值漏洞
    return user

# 应该触发 race-condition-financial-transaction 规则
def transfer_money(from_account, to_account, amount):
    balance = get_balance(from_account)
    new_balance = balance - amount  # 没有并发控制
    update_balance(from_account, new_balance)
    
    # 更新收款方余额
    to_balance = get_balance(to_account)
    new_to_balance = to_balance + amount
    update_balance(to_account, new_to_balance)

# 应该触发 timing-attack-user-enumeration 规则
def check_user_exists(email):
    user = User.find_by_email(email)
    if user:
        return "User exists"
    else:
        return "User not found"  # 不同的响应时间可能导致时序攻击

# 应该触发 price-manipulation-negative-price 规则
def calculate_total(price, quantity):
    total = price * quantity  # 没有验证负数价格
    return total

# 应该触发 price-manipulation-zero-price 规则
def add_to_cart(product_id, price):
    if price >= 0:  # 允许零价格商品
        cart.add_item(product_id, price)

# 应该触发 discount-manipulation-unlimited 规则
def apply_discount(original_price, discount_percentage):
    final_price = original_price * (1 - discount_percentage / 100)  # 没有折扣上限验证
    return final_price

# 应该触发 price-manipulation-coupon-stacking 规则
def apply_coupons(coupons):
    total_discount = 0
    for coupon in coupons:  # 没有检查优惠券使用限制
        total_discount += apply_coupon(coupon)
    return total_discount