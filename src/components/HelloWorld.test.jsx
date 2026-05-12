import React from 'react';
import { render, screen } from '@testing-library/react';
import HelloWorld from './HelloWorld';

describe('HelloWorld Component', () => {
  test('renders Hello, World! text', () => {
    render(<HelloWorld />);
    const headingElement = screen.getByText(/Hello, World!/i);
    expect(headingElement).toBeInTheDocument();
  });
});
