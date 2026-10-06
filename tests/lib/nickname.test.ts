import { describe, expect, it } from 'vitest';
import { checkNickname } from '@/lib/nickname';

describe('checkNickname', () => {
  it.each(['abc', 'Jogador_1', 'dev-ops', 'a'.repeat(20), '  trimmed  '])('accepts %j', (nick) => {
    expect(checkNickname(nick)).toEqual({ ok: true, nickname: nick.trim() });
  });

  it.each(['ab', 'a'.repeat(21), 'joão', 'com espaço', 'emoji🧡', ''])(
    'rejects %j as bad format',
    (nick) => {
      expect(checkNickname(nick)).toEqual({ ok: false, reason: 'format' });
    },
  );

  it.each(['caralho', 'xX_fuck_Xx', 'p0rr4', 'puta', 'fdp-123', 'Viado'])(
    'rejects %j as profanity',
    (nick) => {
      expect(checkNickname(nick)).toEqual({ ok: false, reason: 'profanity' });
    },
  );

  it.each(['computador', 'curioso', 'pausa', 'Cupertino', 'pintor'])(
    'does not flag the harmless word %j',
    (nick) => {
      expect(checkNickname(nick).ok).toBe(true);
    },
  );
});
