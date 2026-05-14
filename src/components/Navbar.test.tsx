import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('renders the logo', () => {
    render(<Navbar />);
    expect(screen.getByText('MyDashboard')).toBeInTheDocument();
  });

  it('renders desktop nav links', () => {
    render(<Navbar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the hamburger menu button', () => {
    render(<Navbar />);
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
  });

  it('toggles the mobile menu on hamburger click', () => {
    render(<Navbar />);
    const toggleBtn = screen.getByLabelText('Toggle menu');

    // Initially closed
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Open
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Close
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes mobile menu when a nav link is clicked', () => {
    render(<Navbar />);
    const toggleBtn = screen.getByLabelText('Toggle menu');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const links = screen.getAllByText('Dashboard');
    fireEvent.click(links[0]);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
