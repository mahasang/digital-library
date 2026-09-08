"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Plus, LayoutDashboard, Menu, X, ArrowLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/lo/blog-admin",      label: "ພາບລວມ",           icon: LayoutDashboard },
  { href: "/lo/blog-admin/new",  label: "ສ້າງບົດຄວາມໃໝ່",   icon: Plus },
];

export default function BlogAdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-gray-200 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-gray-900">Blog Admin</p>
            <p className="text-xs text-gray-400">ຈັດການບົດຄວາມ</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/lo/blog-admin" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to site */}
        <div className="mt-auto border-t border-gray-200 p-3">
          <Link
            href="/lo/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ກັບໄປ Dashboard
          </Link>
          <Link
            href="/lo/blog"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            ເບິ່ງ Blog
          </Link>
        </div>
      </aside>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}