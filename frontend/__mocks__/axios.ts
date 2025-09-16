// Mock axios for testing
const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
};

const mockAxios: any = jest.fn(() => mockAxiosInstance);
mockAxios.create = jest.fn(() => mockAxiosInstance);
mockAxios.isAxiosError = jest.fn(() => false);

// Add default export
export default mockAxios;

// Add named exports to match axios structure
export const create = mockAxios.create;
export const isAxiosError = mockAxios.isAxiosError;
export const get = mockAxios.get;
export const post = mockAxios.post;
export const put = mockAxios.put;
export const deleteMethod = mockAxios.delete;
export const patch = mockAxios.patch;