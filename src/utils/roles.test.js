import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_OPTIONS, normalizeRole, isAdminRole, isWriterRole,
  canRoleAccessModule, canRolePerformAction,
} from './roles.js';

test('exactly six canonical roles and the six approved aliases', () => {
  assert.deepEqual(ROLE_OPTIONS.map(({ id }) => id),
    ['admin', 'editor', 'diseñador', 'corrector', 'finanzas', 'visualizador']);
  for (const [alias, expected] of Object.entries({
    administrador: 'admin', direccion: 'admin', maquetador: 'diseñador',
    asistente: 'editor', contador: 'finanzas', 'solo lectura': 'visualizador',
  })) assert.equal(normalizeRole(alias), expected);
  assert.equal(normalizeRole(' DISEÑADOR '), 'diseñador');
  assert.equal(normalizeRole('disen\u0303ador'), 'diseñador');
});

test('viewer can read but never write through any action alias', () => {
  for (const role of ['visualizador', 'solo lectura']) {
    assert.equal(canRoleAccessModule(role, 'clients'), true);
    assert.equal(canRolePerformAction(role, 'clients', 'read'), true);
    for (const action of ['write', 'crear', 'editar', 'eliminar', 'administrar']) {
      assert.equal(canRolePerformAction(role, 'clients', action), false);
    }
    assert.equal(isWriterRole(role), false);
  }
});

test('unknown, inherited object names and missing roles fail closed', () => {
  for (const role of ['unknown', '__proto__', 'constructor', '', null, undefined, {}, 1]) {
    assert.equal(normalizeRole(role), null);
    assert.equal(isAdminRole(role), false);
    assert.equal(isWriterRole(role), false);
    assert.equal(canRoleAccessModule(role, 'clients'), false);
    assert.equal(canRolePerformAction(role, 'clients', 'write'), false);
  }
});

test('canonical writers retain their existing module scope', () => {
  for (const role of ['admin', 'editor', 'diseñador', 'corrector', 'finanzas']) {
    assert.equal(isWriterRole(role), true);
    assert.equal(canRolePerformAction(role, 'clients', 'write'), true);
  }
  assert.equal(canRolePerformAction('finanzas', 'incomes'), true);
  assert.equal(canRolePerformAction('contador', 'incomes'), true);
  assert.equal(canRolePerformAction('editor', 'incomes'), false);
  assert.equal(canRolePerformAction('maquetador', 'services'), true);
  assert.equal(canRolePerformAction('asistente', 'clients'), true);
  assert.equal(canRolePerformAction('direccion', 'configuration'), true);
});
