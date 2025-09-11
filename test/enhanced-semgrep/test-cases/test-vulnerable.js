// 测试用例：SQL注入漏洞
function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = '" + userId + "'";
    return db.query(query);
}

// 测试用例：XSS漏洞
function displayUserContent(content) {
    document.getElementById('output').innerHTML = content;
}

// 测试用例：路径遍历漏洞
function readUserFile(filename) {
    return fs.readFileSync('/var/www/uploads/' + filename);
}

// 测试用例：命令注入漏洞
function executeUserCommand(command) {
    exec(command);
}

// 测试用例：跨函数数据流
function getUserInput() {
    return req.body.userData;
}

function processUserData() {
    const data = getUserInput();
    dangerousOperation(data);
}

// 测试用例：安全编码示例
function safeGetUserData(userId) {
    const query = "SELECT * FROM users WHERE id = ?";
    return db.query(query, [userId]);
}

function safeDisplayUserContent(content) {
    document.getElementById('output').textContent = content;
}