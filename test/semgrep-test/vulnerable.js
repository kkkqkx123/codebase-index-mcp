// 测试Semgrep规则检测

// 应该触发 javascript-sql-injection 规则
function unsafeQuery(userInput) {
    const query = "SELECT * FROM users WHERE id = '" + userInput + "'";
    return db.query(query);
}

// 应该触发 javascript-xss-reflected 规则
function renderUserContent(userInput) {
    document.getElementById('output').innerHTML = userInput;
}

// 应该触发 javascript-hardcoded-secret 规则
const API_KEY = "sk-1234567890abcdef";

// 应该触发 javascript-eval-usage 规则
eval(userCode);

// 应该触发 javascript-prototype-pollution 规则
obj["__proto__"][key] = value;