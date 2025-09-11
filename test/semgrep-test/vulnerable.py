# 测试Semgrep规则检测

import sqlite3
import os
import subprocess
import pickle
import hashlib

# 应该触发 python-sql-injection 规则
def unsafe_query(user_input):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE id = {user_input}"
    cursor.execute(query)
    return cursor.fetchall()

# 应该触发 python-command-injection 规则
def run_command(user_input):
    os.system(user_input)

# 应该触发 python-hardcoded-secret 规则
PASSWORD = "my-secret-password-123"

# 应该触发 python-deserialization 规则
def load_data(user_input):
    return pickle.loads(user_input)

# 应该触发 python-weak-crypto 规则
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()