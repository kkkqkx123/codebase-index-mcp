import 'reflect-metadata';
import { Container } from 'inversify';
import { LazyServiceLoader } from '../LazyServiceLoader';
import { TYPES } from '../../types';

// Mock logger service
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('LazyServiceLoader', () => {
  let container: Container;
  let lazyLoader: LazyServiceLoader;

  beforeEach(() => {
    container = new Container();
    lazyLoader = new LazyServiceLoader(container);
    lazyLoader.setLogger(mockLogger);
  });

  it('should create LazyServiceLoader instance', () => {
    expect(lazyLoader).toBeDefined();
  });

  it('should track loaded services', () => {
    expect(lazyLoader.isServiceLoaded(TYPES.VectorStorageService)).toBeFalsy();
    expect(lazyLoader.getLoadedServices()).toEqual([]);
  });

  it('should set logger', () => {
    const newLogger = { info: jest.fn() };
    lazyLoader.setLogger(newLogger);
    expect(lazyLoader['logger']).toBe(newLogger);
  });
});