import React from 'react';
import Link from 'next/link';

const Sidebar: React.FC = () => {
  return (
    // Hidden on screens smaller than md, fixed width on md and larger
    <aside className="hidden md:block md:w-64 bg-gray-100 p-4 border-r border-gray-200 h-screen sticky top-0">
      <nav>
        <ul className="space-y-2">
          <li>
            <Link href="/" className="block py-2 px-3 rounded hover:bg-gray-200 text-gray-700">
              Home
            </Link>
          </li>
          <li>
            <Link href="/profile" className="block py-2 px-3 rounded hover:bg-gray-200 text-gray-700">
              Profile
            </Link>
          </li>
          <li>
            <Link href="/settings" className="block py-2 px-3 rounded hover:bg-gray-200 text-gray-700">
              Settings
            </Link>
          </li>
          {/* Add more navigation links as needed */}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar; 