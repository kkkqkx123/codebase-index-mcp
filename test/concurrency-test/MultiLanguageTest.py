import threading
import asyncio

class Counter:
    def __init__(self):
        self.counter = 0
    
    def increment(self):
        self.counter = self.counter + 1  # Race condition

class SharedData:
    def __init__(self):
        self.data = {}
    
    def add_data(self, key, value):
        self.data[key] = value  # Race condition

global_var = 0

def worker():
    global global_var
    global_var = global_var + 1  # Race condition

def file_access():
    with open('test.txt', 'w') as f:  # Race condition
        f.write('test')

async def async_task():
    await asyncio.sleep(1)  # Potential race condition

def create_thread():
    threading.Thread(target=worker).start()  # Race condition

if __name__ == "__main__":
    create_thread()