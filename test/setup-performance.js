// 性能测试设置文件
// 在测试开始前强制进行垃圾回收

beforeAll(() => {
  // 强制暴露GC函数
  if (global.gc) {
    global.gc();
  }
});

afterEach(() => {
  // 每个测试后强制垃圾回收
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  // 所有测试完成后强制垃圾回收
  if (global.gc) {
    global.gc();
  }
});