import { render, screen, within } from './test-utils';
import App from '../App';

describe('App Component', () => {
  test('renders welcome message', () => {
    render(<App />);
    const welcomeElement = screen.getByText(/Codebase Index Dashboard/i);
    expect(welcomeElement).toBeInTheDocument();
  });

  test('renders header with correct title', () => {
    render(<App />);
    const headerElement = screen.getByRole('banner');
    expect(within(headerElement).getByText(/Codebase Index MCP/i)).toBeInTheDocument();
  });

  test('renders main content area', () => {
    render(<App />);
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
  });
});