import java.util.*;
import java.io.*;
import java.util.concurrent.atomic.AtomicInteger;

public class EnhancedRaceConditionExample {
    // 测试 race-condition-shared-variable-access
    private int sharedCounter = 0;
    
    public void incrementCounter() {
        sharedCounter++; // 竞态条件
    }
    
    public int getCounter() {
        return sharedCounter; // 竞态条件
    }
    
    // 测试 race-condition-static-variable
    private static int staticCounter = 0;
    
    public void incrementStatic() {
        staticCounter++; // 竞态条件
    }
    
    public static int getStaticCounter() {
        return staticCounter; // 竞态条件
    }
    
    // 测试 race-condition-shared-variable-assignment
    private String sharedString = "initial";
    
    public void updateString(String value) {
        sharedString = value; // 竞态条件
    }
    
    // 测试 race-condition-unsynchronized-map-access 和 race-condition-concurrent-map-access
    private Map<String, Integer> sharedMap = new HashMap<>();
    
    public void addToMap(String key, Integer value) {
        sharedMap.put(key, value); // 竞态条件
    }
    
    public Integer getFromMap(String key) {
        return sharedMap.get(key); // 竞态条件
    }
    
    // 测试 race-condition-counter-increment
    private int unsafeCounter = 0;
    
    public void unsafeIncrement() {
        unsafeCounter = unsafeCounter + 1; // 竞态条件
    }
    
    // 测试 race-condition-file-access
    public void readFile(String filename) {
        try {
            FileInputStream fis = new FileInputStream(filename); // 竞态条件
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    
    // 测试 race-condition-resource-pool
    class ResourcePool {
        public Resource acquire() {
            return new Resource(); // 竞态条件
        }
    }
    
    // 正确的实现示例
    private final AtomicInteger atomicCounter = new AtomicInteger(0);
    private final Map<String, Integer> concurrentMap = new ConcurrentHashMap<>();
    
    public void safeIncrement() {
        atomicCounter.incrementAndGet(); // 线程安全
    }
    
    public void safeAddToMap(String key, Integer value) {
        concurrentMap.put(key, value); // 线程安全
    }
    
    class Resource {
        // 资源类定义
    }
    
    public static void main(String[] args) {
        EnhancedRaceConditionExample example = new EnhancedRaceConditionExample();
        
        // 启动多个线程测试竞态条件
        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                example.incrementCounter();
                example.incrementStatic();
                example.unsafeIncrement();
                example.readFile("test.txt");
            }).start();
        }
    }
}