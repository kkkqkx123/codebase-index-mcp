// 测试死锁检测规则
public class DeadlockExample {
    private final Object lock1 = new Object();
    private final Object lock2 = new Object();
    
    // 潜在死锁：锁顺序不一致
    public void method1() {
        synchronized (lock1) {
            System.out.println("Thread 1: Holding lock 1...");
            synchronized (lock2) {
                System.out.println("Thread 1: Holding lock 1 and lock 2...");
            }
        }
    }
    
    public void method2() {
        synchronized (lock2) {
            System.out.println("Thread 2: Holding lock 2...");
            synchronized (lock1) {
                System.out.println("Thread 2: Holding lock 2 and lock 1...");
            }
        }
    }
    
    // 竞态条件：共享变量非同步访问
    private int counter = 0;
    
    public void increment() {
        counter++; // 非原子操作，可能导致竞态条件
    }
    
    public int getCounter() {
        return counter; // 可能读取到不一致的值
    }
    
    // 线程安全问题：非线程安全的SimpleDateFormat
    private static final java.text.SimpleDateFormat dateFormat = new java.text.SimpleDateFormat("yyyy-MM-dd");
    
    public String formatDate(java.util.Date date) {
        return dateFormat.format(date); // SimpleDateFormat不是线程安全的
    }
    
    // 静态变量竞态条件
    private static int sharedStaticCounter = 0;
    
    public static void incrementStatic() {
        sharedStaticCounter++; // 静态变量的竞态条件
    }
    
    public static int getStaticCounter() {
        return sharedStaticCounter;
    }
}