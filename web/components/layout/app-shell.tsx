'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bell,
  CircleHelp,
  FileKey2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

type AppShellProps = {
  currentUser: AppUser;
  activePage: 'dashboard' | 'case' | 'settings' | 'users' | 'policies';
  caseCount: number;
  children: ReactNode;
};

const roleLabels = {
  ADMIN: 'Administrator',
  AUTHORIZATION_SPECIALIST: 'PA Specialist',
  SUPERVISOR: 'Supervisor',
  AUDITOR: 'Auditor',
} as const;

export function BrandMark() {
  return (
    <div className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#60d7c3] text-[#16383c] shadow-[0_8px_24px_rgba(58,202,179,0.24)]">
      <span className="absolute h-4 w-1.5 rounded-full bg-current" />
      <span className="absolute h-1.5 w-4 rounded-full bg-current" />
    </div>
  );
}

function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function AppShell({
  currentUser,
  activePage,
  caseCount,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const canManageUsers = currentUser.permissions.includes('users.manage');
  const canManagePolicies = currentUser.permissions.includes('policies.manage');
  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/',
      active: activePage === 'dashboard',
    },
    {
      label: 'Cases',
      icon: FolderKanban,
      count: caseCount,
      href: '/',
      active: activePage === 'case',
    },
    ...(canManageUsers
      ? [
          {
            label: 'Admin · Users',
            icon: Users,
            href: '/admin/users',
            active: activePage === 'users',
          },
      ]
      : []),
    ...(canManagePolicies
      ? [
          {
            label: 'Admin · Policies',
            icon: FileKey2,
            href: '/admin/policies',
            active: activePage === 'policies',
          },
        ]
      : []),
  ];
  const activeLabel =
    activePage === 'policies'
      ? 'Admin · Policies'
      : activePage === 'users'
      ? 'Admin · Users'
      : activePage === 'case'
        ? 'Case detail'
        : 'Prior Authorization';
  const userInitials = initials(currentUser.displayName);

  return (
    <div className="min-h-screen bg-[#eaf0f6] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col bg-[#17363a] px-4 py-5 text-white lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60d7c3]"
        >
          <BrandMark />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              Reliable Medical
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
              Operations
            </p>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="mt-9 space-y-1">
          {navItems.map((item) => {
            const className = cn(
              'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
              item.active
                ? 'bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                : 'text-white/65 hover:bg-white/[0.07] hover:text-white',
            );
            const content = (
              <>
                <item.icon
                  className={cn('size-[18px]', item.active && 'text-[#68ddc7]')}
                />
                <span>{item.label}</span>
                {item.count ? (
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/65">
                    {item.count}
                  </span>
                ) : null}
              </>
            );

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                disabled
                className={className}
              >
                {content}
              </button>
            );
          })}
        </nav>

        <div className="mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Workspace</div>
        <nav aria-label="Workspace navigation" className="mt-2 space-y-1">
          <Link href="/settings" className={cn('flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium', activePage === 'settings' ? 'bg-white/[0.11] text-white' : 'text-white/65 hover:bg-white/[0.07] hover:text-white')}><Settings className="size-[18px]" />Settings</Link>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <div className="flex items-center gap-2 text-[#78dfcc]">
            <ShieldCheck className="size-4" />
            <p className="text-xs font-semibold">Human review required</p>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-white/48">
            Review every case before any external submission.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 px-2">
          <Avatar className="size-8 after:border-white/10">
            <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white/85">
              {currentUser.displayName}
            </p>
            <p className="truncate text-[10px] text-white/40">
              {roleLabels[currentUser.role]}
            </p>
          </div>
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60d7c3]"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-300/80 bg-slate-50/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <Menu />
            </Button>
            <BrandMark />
            <span className="hidden text-sm font-semibold text-slate-800 sm:inline">
              Reliable Medical
            </span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 lg:flex">
            <LayoutDashboard className="size-4" />
            <span>Operations</span>
            <span>/</span>
            <span className="font-medium text-slate-700">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge
              variant="outline"
              className="mr-1 hidden h-7 border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 sm:inline-flex"
            >
              <Sparkles className="size-3" />
              Synthetic workspace
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Help"
              className="text-slate-500"
            >
              <CircleHelp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative text-slate-500"
            >
              <Bell />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
            </Button>
            <Avatar className="ml-1 size-8 after:border-slate-200">
              <AvatarFallback className="bg-slate-800 text-xs font-semibold text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {mobileNavOpen ? (
          <nav
            aria-label="Mobile navigation"
            className="border-b border-slate-300 bg-slate-50 px-4 py-3 lg:hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                      item.active
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600',
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400"
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </button>
                ),
              )}
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-600"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        ) : null}

        {children}
      </div>
    </div>
  );
}
