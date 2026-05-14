import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Projects', href: '/projects' },
  { label: 'Settings', href: '/settings' },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  return (
    <nav className="bg-white shadow-md w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="/dashboard" className="text-xl font-bold text-indigo-600">
              MyDashboard
            </a>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-indigo-600 font-medium transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop User Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <button className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors duration-200">
              Log out
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold">
              U
            </div>
          </div>

          {/* Hamburger Button (mobile only) */}
          <div className="flex md:hidden">
            <button
              onClick={toggleMenu}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              className="p-2 rounded-md text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-2 pb-4 space-y-1 bg-white border-t border-gray-100">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}

          {/* Divider */}
          <div className="border-t border-gray-100 my-2" />

          {/* Mobile User Actions */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold">
                U
              </div>
              <span className="text-sm font-medium text-gray-700">User Name</span>
            </div>
            <button className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors duration-200">
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
