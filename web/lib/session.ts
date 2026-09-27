'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Me, Role } from './types';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me') });

export const homeFor = (role: Role) => (role === 'DRIVER' ? '/driver' : '/ride');
