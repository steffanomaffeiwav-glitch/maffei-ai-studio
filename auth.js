
import { supabase } from './supabase.js';

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  const response = await fetch('/api/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
  });

  if (!response.ok) {
    await supabase.auth.signOut();
    throw new Error('Não foi possível validar a sessão no servidor.');
  }

  return data;
}

export async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } finally {
    await supabase.auth.signOut();
  }
}

export async function getSession() {
  const response = await fetch('/api/session', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store'
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.user ? { user: data.user } : null;
}

