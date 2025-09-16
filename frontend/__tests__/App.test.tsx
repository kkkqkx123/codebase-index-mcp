import { render, screen } from './test-utils';
import App from '../App';

describe('App Component', () => {
  test('renders welcome message', () => {
    render(<App />);
    const welcomeElement = screen.getByText(/Welcome to the Codebase Index MCP Frontend/i);
    expect(welcomeElement).toBeInTheDocument();
  });

  test('renders header with correct title', () => {
    render(<App />);
    const headerElement = screen.getByText(/Codebase Index MCP - Frontend Interface/i);
    expect(headerElement).toBeInTheDocument();
  });

  test('renders main content area', () => {
    render(<App />);
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
  });
});