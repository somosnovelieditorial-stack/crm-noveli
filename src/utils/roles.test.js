import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_OPTIONS, normalizeRole, isAdminRole, isWriterRole,
  canRoleAccessModule, canRolePerformAction, canDeleteEntity, isFinanceRole, isFinanceModule,
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

test('DELETE follows admin and operational RLS; unknown tables and roles fail closed', () => {
  for (const table of ['clients', 'prospects', 'quotations', 'services', 'providers',
    'service_catalog', 'service_packs', 'activity_log', 'website_settings',
    'website_sections', 'website_services', 'website_books', 'website_links']) {
    assert.equal(canDeleteEntity('admin', table), true);
    assert.equal(canDeleteEntity('direccion', table), true);
    for (const role of ['editor', 'diseñador', 'corrector', 'finanzas', 'visualizador', null, 'unknown'])
      assert.equal(canDeleteEntity(role, table), false);
  }
  for (const table of ['quotation_items', 'service_pack_items', 'service_checklists',
    'service_stages', 'editorial_stages', 'documents', 'agenda_events']) {
    for (const role of ['admin', 'editor', 'diseñador', 'corrector', 'finanzas'])
      assert.equal(canDeleteEntity(role, table), true);
    for (const role of ['visualizador', 'unknown', null])
      assert.equal(canDeleteEntity(role, table), false);
  }
  assert.equal(canDeleteEntity('admin', 'unreviewed_table'), false);
});

test('financial modules fail closed except admin/finance, including read-only viewers', () => {
  for (const module of ['incomes', 'expenses', 'taxes', 'currency_rates', 'staff', 'reserve', 'reports']) {
    assert.equal(isFinanceModule(module), true);
    for (const role of ['admin', 'finanzas', 'contador', 'direccion']) {
      assert.equal(isFinanceRole(role), true);
      assert.equal(canRoleAccessModule(role, module), true);
      assert.equal(canRolePerformAction(role, module, 'read'), true);
      assert.equal(canRolePerformAction(role, module, 'write'), true);
    }
    for (const role of ['editor', 'diseñador', 'corrector', 'visualizador', 'unknown', null]) {
      assert.equal(isFinanceRole(role), false);
      assert.equal(canRoleAccessModule(role, module), false);
      assert.equal(canRolePerformAction(role, module, 'read'), false);
      assert.equal(canRolePerformAction(role, module, 'write'), false);
    }
  }
  assert.equal(canRoleAccessModule('finanzas', 'configuration'), false);
  assert.equal(canRoleAccessModule('finanzas', 'settings-audit'), false);
  for (const table of ['incomes', 'income_allocations', 'income_distributions',
    'income_tax_reservations', 'expenses', 'client_funds', 'fund_movements',
    'operational_reserve_movements', 'payroll_payments', 'staff', 'exchange_rates',
    'settings', 'company_settings']) {
    assert.equal(canDeleteEntity('admin', table), true);
    for (const role of ['finanzas', 'editor', 'diseñador', 'corrector', 'visualizador', 'unknown'])
      assert.equal(canDeleteEntity(role, table), false);
  }
});
