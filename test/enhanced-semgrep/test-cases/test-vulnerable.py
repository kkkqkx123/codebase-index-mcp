# 测试用例：SQL注入漏洞
def get_user_data(user_id):
    query = f"SELECT * FROM users WHERE id = '{user_id}'"
    return db.execute(query)

# 测试用例：命令注入漏洞
def execute_user_command(command):
    os.system(command)

# 测试用例：路径遍历漏洞
def read_user_file(filename):
    file_path = "/var/www/uploads/" + filename
    with open(file_path, 'r') as f:
        return f.read()

# 测试用例：跨函数数据流
def get_user_input():
    return request.form['user_data']

def process_user_data():
    data = get_user_input()
    dangerous_operation(data)

# 测试用例：安全编码示例
def safe_get_user_data(user_id):
    query = "SELECT * FROM users WHERE id = %s"
    return db.execute(query, (user_id,))

def safe_execute_command(filename):
    allowed_files = ["file1.txt", "file2.txt"]
    if filename in allowed_files:
        subprocess.call(["cat", filename])

def safe_read_user_file(filename):
    base_dir = "/var/www/uploads/"
    canonical_path = os.path.realpath(os.path.join(base_dir, filename))
    if canonical_path.startswith(base_dir):
        with open(canonical_path, 'r') as f:
            return f.read()
    else:
        raise ValueError("Invalid path")