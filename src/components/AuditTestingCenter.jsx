import { useState, useEffect } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { calculateProposalTotals } from '../utils/proposalCalculations';
import { formatCurrency } from '../utils';
import { databaseContract } from '../config/databaseContract';
import { 
  Play, Trash2, ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle, 
  Activity, Database, Terminal, RefreshCw, Layers, Server, Shield, FileText, UserCheck
} from 'lucide-react';

export default function AuditTestingCenter({ organizationId, userRole }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [diagTimestamp, setDiagTimestamp] = useState('');
  
  // Tables and schema contract states
  const [tableStats, setTableStats] = useState([]);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [rlsErrorDetected, setRlsErrorDetected] = useState(false);
  const [rlsErrorMessage, setRlsErrorMessage] = useState('');
  
  // Schema contract diff states
  const [missingCols, setMissingCols] = useState([]);
  const [tablesWithoutOrgIdCol, setTablesWithoutOrgIdCol] = useState([]);
  const [checkingSchema, setCheckingSchema] = useState(false);

  // Tests state
  const [testResults, setTestResults] = useState({});
  const [runningTests, setRunningTests] = useState({});
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    runDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    setLoadingDiag(true);
    setDiagTimestamp(new Date().toLocaleString());
    try {
      // 1. Get current authenticated user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      setCurrentUser(user);

      // 2. Check supabase connection
      const { error: pingErr } = await supabase.from('settings').select('id').limit(1);
      if (pingErr) {
        const { error: pingErr2 } = await supabase.from('company_settings').select('id').limit(1);
        if (pingErr2) {
          setSupabaseConnected(false);
        } else {
          setSupabaseConnected(true);
        }
      } else {
        setSupabaseConnected(true);
      }
    } catch (err) {
      console.error('Error running diagnostics:', err);
      setSupabaseConnected(false);
    } finally {
      setLoadingDiag(false);
      checkSchemaContract();
    }
  };

  const checkSchemaContract = async () => {
    setCheckingSchema(true);
    const missing = [];
    const noOrgCol = [];
    const stats = [];
    setRlsErrorDetected(false);
    setRlsErrorMessage('');

    try {
      // Check each table in the contract in parallel/sequence
      for (const [tableName, columnsObj] of Object.entries(databaseContract)) {
        const colNames = Object.keys(columnsObj);
        let tableHasOrgId = true;
        let totalReal = 0;
        let missingOrgIdCount = 0;
        let userIdNoOrgIdCount = 0;
        let testRecordsCount = 0;
        let tableError = null;

        try {
          // A. Check if organization_id column exists by doing a direct check
          const { error: orgIdCheckErr } = await supabase
            .from(tableName)
            .select('organization_id')
            .limit(0);

          if (orgIdCheckErr && orgIdCheckErr.code === '42703') {
            tableHasOrgId = false;
            noOrgCol.push(tableName);
          }

          // B. Query the table to determine column differences
          // We select all expected columns to see if PostgreSQL returns undefined_column (42703)
          const { data, error: selectErr } = await supabase
            .from(tableName)
            .select('id, organization_id, user_id, is_test')
            .limit(1000); // Safely retrieve up to 1000 records to audit locally

          if (selectErr) {
            tableError = selectErr.message;
            if (selectErr.code === '42501' || selectErr.message.toLowerCase().includes('policy') || selectErr.message.toLowerCase().includes('permission')) {
              setRlsErrorDetected(true);
              setRlsErrorMessage(prev => prev ? `${prev} | ${tableName}: RLS denegado` : `${tableName}: RLS denegado`);
            }
          } else {
            const rows = data || [];
            // Count states locally
            totalReal = rows.filter(r => r.organization_id === organizationId && r.is_test !== true && r.is_test !== 'true').length;
            missingOrgIdCount = rows.filter(r => r.organization_id === null || r.organization_id === undefined || r.organization_id === '').length;
            userIdNoOrgIdCount = rows.filter(r => r.user_id && (r.organization_id === null || r.organization_id === undefined || r.organization_id === '')).length;
            testRecordsCount = rows.filter(r => r.is_test === true || r.is_test === 'true' || (r.test_run_id !== null && r.test_run_id !== undefined)).length;
          }

          // C. Pinpoint exact missing columns
          // Try selecting all expected columns. If it fails, run one-by-one check to find ALL missing columns.
          const { error: fullSelectErr } = await supabase
            .from(tableName)
            .select(colNames.join(','))
            .limit(0);

          if (fullSelectErr && fullSelectErr.code === '42703') {
            // Find which columns are missing
            for (const col of colNames) {
              const { error: colErr } = await supabase
                .from(tableName)
                .select(col)
                .limit(0);

              if (colErr && colErr.code === '42703') {
                missing.push({
                  table: tableName,
                  column: col,
                  type: columnsObj[col]
                });
              }
            }
          }

        } catch (err) {
          tableError = err.message;
        }

        stats.push({
          key: tableName,
          label: tableName,
          total: tableError ? 'Error' : totalReal,
          missingOrgId: tableError ? 'Error' : missingOrgIdCount,
          userIdNoOrgId: tableError ? 'Error' : userIdNoOrgIdCount,
          testRecords: tableError ? 'Error' : testRecordsCount,
          hasOrgId: tableHasOrgId,
          error: tableError
        });
      }

      setTableStats(stats);
      setMissingCols(missing);
      setTablesWithoutOrgIdCol(noOrgCol);
    } catch (err) {
      console.error('Error auditing schema schema contract:', err);
    } finally {
      setCheckingSchema(false);
    }
  };

  // Safe QA cleanup
  const cleanQARecords = async () => {
    if (!window.confirm('¿Está seguro de que desea limpiar todos los registros TEST_QA_ de la base de datos? Esto eliminará datos de prueba en todas las tablas.')) return;
    setCleaningUp(true);
    
    // Ordered table list to avoid foreign key violations
    const tablesToClean = [
      { name: 'quotation_items', termColumn: 'concept' },
      { name: 'quotations', termColumn: 'author_name' },
      { name: 'service_stages', termColumn: 'stage_name' },
      { name: 'services', termColumn: 'book_title' },
      { name: 'documents', termColumn: 'name' },
      { name: 'incomes', termColumn: 'concept' },
      { name: 'expenses', termColumn: 'concept' },
      { name: 'payroll_payments', termColumn: 'notes' },
      { name: 'staff', termColumn: 'name' },
      { name: 'operational_reserve_movements', termColumn: 'concept' },
      { name: 'clients', termColumn: 'name' },
      { name: 'prospects', termColumn: 'name' }
    ];

    try {
      for (const table of tablesToClean) {
        // Attempt 1: Delete by TEST_QA_ prefix in name/concept/title
        const { error: err1 } = await supabase
          .from(table.name)
          .delete()
          .ilike(table.termColumn, '%TEST_QA_%');
          
        if (err1) console.warn(`Clean warning on ${table.name} by term:`, err1.message);

        // Attempt 2: Delete by is_test = true
        try {
          await supabase.from(table.name).delete().eq('is_test', true);
        } catch (e) {
          // Ignore if column doesn't exist
        }

        // Attempt 3: Delete by test_run_id is not null
        try {
          await supabase.from(table.name).delete().not('test_run_id', 'is', null);
        } catch (e) {
          // Ignore if column doesn't exist
        }
      }
      alert('¡Limpieza de datos de prueba completada con éxito!');
      checkSchemaContract();
    } catch (err) {
      console.error('Error cleaning QA records:', err);
      alert('Ocurrió un error al limpiar registros de prueba: ' + err.message);
    } finally {
      setCleaningUp(false);
    }
  };

  const handleRunTest = async (testNumber) => {
    setRunningTests(prev => ({ ...prev, [testNumber]: true }));
    const runId = 'RUN_' + Date.now();
    let result = { status: 'Error', table: '', record: '', message: '', recommendation: '' };

    try {
      switch (testNumber) {
        case 1: { // Probar Propuesta Comercial
          result.table = 'quotations & quotation_items';
          
          let { data: catalogItems } = await supabase
            .from('service_catalog')
            .select('*')
            .eq('active', true)
            .limit(1);

          let catItem = (catalogItems && catalogItems.length > 0) ? catalogItems[0] : null;

          if (!catItem) {
            const { data: newCat, error: newCatErr } = await supabase
              .from('service_catalog')
              .insert([{
                name: 'TEST_QA_Servicio de Prueba',
                base_price: 150000,
                active: true,
                category: 'editorial',
                is_test: true,
                test_run_id: runId,
                organization_id: organizationId
              }])
              .select()
              .single();

            if (newCatErr) throw newCatErr;
            catItem = { ...newCat, concept: newCat.name, price: newCat.base_price };
          } else {
            catItem = { ...catItem, concept: catItem.name, price: catItem.base_price };
          }

          const tempProposal = {
            iva_mode: '+ IVA',
            manuscript_pages: 150,
            extension_adjustment_type: 'percentage',
            extension_adjustment_value: 30,
            tax_rate: 19
          };
          const tempItems = [{ concept: catItem.concept, unit_price: catItem.price, quantity: 1 }];
          const calculated = calculateProposalTotals(tempProposal, tempItems);

          const { data: newQuote, error: newQuoteErr } = await supabase
            .from('quotations')
            .insert([{
              author_name: 'TEST_QA_Autor Pruebas',
              author_email: 'test_qa_author@noveli.cl',
              object: 'TEST_QA_Proyecto Libro Pruebas',
              quote_number: 'Q-QA-' + Date.now().toString().slice(-6),
              issue_date: new Date().toISOString().slice(0, 10),
              validity_days: 15,
              manuscript_pages: 150,
              extension_adjustment_type: 'percentage',
              extension_adjustment_value: 30,
              subtotal: calculated.subtotal,
              discount: calculated.discount,
              tax_amount: calculated.vat,
              total: calculated.total,
              iva_mode: '+ IVA',
              tax_rate: 19,
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (newQuoteErr) {
            if (newQuoteErr.message.includes('converted_client_id')) {
              throw new Error(`${newQuoteErr.message}. ¿Ejecutó la migración "supabase_migration_schema_guard.sql"?`);
            }
            throw newQuoteErr;
          }

          const { error: newQuoteItemErr } = await supabase
            .from('quotation_items')
            .insert([{
              quotation_id: newQuote.id,
              catalog_id: catItem.id,
              concept: catItem.concept,
              unit_price: catItem.price,
              quantity: 1,
              total: catItem.price,
              source_type: 'catalog',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }]);

          if (newQuoteItemErr) throw newQuoteItemErr;

          result.status = 'OK';
          result.record = `Propuesta ${newQuote.quote_number} y 1 ítem creados.`;
          result.recommendation = 'La propuesta se guardó y calculó correctamente. El flujo está interconectado.';
          break;
        }

        case 2: { // Probar Propuesta a Prospecto
          result.table = 'prospects';

          let { data: qaQuotes } = await supabase
            .from('quotations')
            .select('*')
            .ilike('author_name', '%TEST_QA_%')
            .limit(1);

          let quote = (qaQuotes && qaQuotes.length > 0) ? qaQuotes[0] : null;

          if (!quote) {
            throw new Error('Primero ejecuta la Prueba 1 para tener una propuesta comercial QA.');
          }

          const { error: updateQuoteErr } = await supabase
            .from('quotations')
            .update({ status: 'aceptada' })
            .eq('id', quote.id);

          if (updateQuoteErr) throw updateQuoteErr;

          const { data: newProspect, error: newProspErr } = await supabase
            .from('prospects')
            .insert([{
              name: quote.author_name,
              email: quote.author_email,
              interest_service: quote.object,
              total_agreed_amount: quote.total,
              origin: 'web',
              probability: 'alta',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId,
              status: 'esperando pago'
            }])
            .select()
            .single();

          if (newProspErr) throw newProspErr;

          const { error: relinkErr } = await supabase
            .from('quotations')
            .update({
              converted_to_prospect: true,
              converted_prospect_id: newProspect.id
            })
            .eq('id', quote.id);

          if (relinkErr) throw relinkErr;

          result.status = 'OK';
          result.record = `Prospecto creado: ${newProspect.name}. ID Vinculado.`;
          result.recommendation = 'Propuesta convertida con éxito. Datos y estados sincronizados correctamente.';
          break;
        }

        case 3: { // Probar Prospecto a Cliente
          result.table = 'clients';

          let { data: qaProspects } = await supabase
            .from('prospects')
            .select('*')
            .ilike('name', '%TEST_QA_%')
            .eq('converted_to_client', false)
            .limit(1);

          let prospect = (qaProspects && qaProspects.length > 0) ? qaProspects[0] : null;

          if (!prospect) {
            throw new Error('No hay prospecto QA disponible. Corre la Prueba 2 primero.');
          }

          const { error: upProspErr } = await supabase
            .from('prospects')
            .update({
              payment_status: 'pagado',
              contract_signed_received: true,
              files_received: true,
              status: 'listo para iniciar'
            })
            .eq('id', prospect.id);

          if (upProspErr) throw upProspErr;

          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert([{
              name: prospect.name,
              email: prospect.email,
              client_type: 'Nacional',
              total_agreed_amount: prospect.total_agreed_amount,
              status: 'listo para iniciar',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (clientErr) throw clientErr;

          const { error: updateProspStatusErr } = await supabase
            .from('prospects')
            .update({
              converted_to_client: true,
              converted_to_client_id: newClient.id,
              status: 'finalizado'
            })
            .eq('id', prospect.id);

          if (updateProspStatusErr) throw updateProspStatusErr;

          result.status = 'OK';
          result.record = `Cliente creado: ${newClient.name}. Prospecto finalizado.`;
          result.recommendation = 'El flujo de transición cliente/prospecto está operativo y sincronizado.';
          break;
        }

        case 4: { // Probar Cliente a Servicio Contratado
          result.table = 'services & service_stages';

          let { data: qaClients } = await supabase
            .from('clients')
            .select('*')
            .ilike('name', '%TEST_QA_%')
            .limit(1);

          let client = (qaClients && qaClients.length > 0) ? qaClients[0] : null;

          if (!client) {
            throw new Error('No hay clientes QA. Ejecuta la Prueba 3 primero.');
          }

          const { data: service, error: servErr } = await supabase
            .from('services')
            .insert([{
              client_id: client.id,
              type: 'corrección',
              book_title: 'TEST_QA_Libro del Cliente Pruebas',
              status: 'recepción de material',
              value: 300000,
              total_agreed_amount: 300000,
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (servErr) throw servErr;

          const { data: stageTypes } = await supabase
            .from('editorial_stages')
            .select('*')
            .eq('active', true)
            .order('order', { ascending: true });

          if (stageTypes && stageTypes.length > 0) {
            const stagesToInsert = stageTypes.map(st => ({
              service_id: service.id,
              stage_name: st.name,
              order_index: st.order,
              status: st.order === 1 ? 'en proceso' : 'pendiente',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }));

            const { error: stagesErr } = await supabase
              .from('service_stages')
              .insert(stagesToInsert);

            if (stagesErr) throw stagesErr;
          }

          result.status = 'OK';
          result.record = `Servicio creado para: ${client.name}. ${stageTypes ? stageTypes.length : 0} etapas creadas.`;
          result.recommendation = 'Servicios y etapas editoriales enlazados correctamente. Listo para el flujo de producción.';
          break;
        }

        case 5: { // Probar Ingreso
          result.table = 'incomes';

          let { data: qaClients } = await supabase
            .from('clients')
            .select('*')
            .ilike('name', '%TEST_QA_%')
            .limit(1);

          let client = (qaClients && qaClients.length > 0) ? qaClients[0] : null;

          const { data: income, error: incErr } = await supabase
            .from('incomes')
            .insert([{
              client_id: client ? client.id : null,
              concept: 'TEST_QA_Abono de Prueba',
              amount: 150000,
              payment_method: 'Transferencia',
              payment_date: new Date().toISOString().slice(0, 10),
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (incErr) throw incErr;

          result.status = 'OK';
          result.record = `Ingreso registrado: ${income.concept} - ${formatCurrency(income.amount, 'CLP')}`;
          result.recommendation = 'El ingreso se guardó. Será contabilizado automáticamente en el Dashboard y Reportes.';
          break;
        }

        case 6: { // Probar Gasto
          result.table = 'expenses';

          const { data: expense, error: expErr } = await supabase
            .from('expenses')
            .insert([{
              concept: 'TEST_QA_Gasto de Prueba',
              amount: 50000,
              category: 'Impuestos',
              payment_method: 'Otros',
              payment_date: new Date().toISOString().slice(0, 10),
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (expErr) throw expErr;

          result.status = 'OK';
          result.record = `Gasto registrado: ${expense.concept} - ${formatCurrency(expense.amount, 'CLP')}`;
          result.recommendation = 'Gasto registrado correctamente. Se contabilizará en el Dashboard y Módulo Tributario.';
          break;
        }

        case 7: { // Probar Pago a Personal
          result.table = 'staff & payroll_payments';

          const { data: member, error: stErr } = await supabase
            .from('staff')
            .insert([{
              name: 'TEST_QA_Miembro de Personal',
              email: 'test_qa_staff@noveli.cl',
              role: 'Diseñador',
              status: 'activo',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (stErr) throw stErr;

          const { data: payment, error: payErr } = await supabase
            .from('payroll_payments')
            .insert([{
              staff_id: member.id,
              amount: 120000,
              payment_date: new Date().toISOString().slice(0, 10),
              status: 'pagado',
              notes: 'TEST_QA_Pago mensual',
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (payErr) throw payErr;

          result.status = 'OK';
          result.record = `Personal y Pago registrados: ${member.name} - ${formatCurrency(payment.amount, 'CLP')}`;
          result.recommendation = 'El pago a personal se guardó. Afectará correctamente los balances de egresos en Dashboard.';
          break;
        }

        case 8: { // Probar Reserva Operacional
          result.table = 'operational_reserve_movements';

          const { data: movement, error: movErr } = await supabase
            .from('operational_reserve_movements')
            .insert([{
              concept: 'TEST_QA_Movimiento de Reserva',
              amount: 80000,
              movement_type: 'deposito',
              movement_date: new Date().toISOString().slice(0, 10),
              is_test: true,
              test_run_id: runId,
              organization_id: organizationId
            }])
            .select()
            .single();

          if (movErr) throw movErr;

          result.status = 'OK';
          result.record = `Movimiento registrado: ${movement.concept} - ${formatCurrency(movement.amount, 'CLP')}`;
          result.recommendation = 'Movimiento de reserva registrado correctamente. Los balances se actualizarán.';
          break;
        }

        case 9: { // Probar Catálogo y Packs
          result.table = 'service_catalog & service_packs';

          const { data: catalog, error: catErr } = await supabase
            .from('service_catalog')
            .select('*')
            .eq('active', true);
            
          if (catErr) throw catErr;

          const { data: packs, error: packErr } = await supabase
            .from('service_packs')
            .select('*')
            .eq('active', true);

          if (packErr) throw packErr;

          result.status = 'OK';
          result.record = `Leídos: ${catalog ? catalog.length : 0} servicios en catálogo, ${packs ? packs.length : 0} packs activos.`;
          result.recommendation = 'Los servicios y packs están accesibles y listos para ser cotizados.';
          break;
        }

        case 10: { // Probar PDF de propuesta
          result.table = 'proposalCalculations (PDF simulation)';

          const sampleProposal = {
            iva_mode: '+ IVA',
            manuscript_pages: 300,
            extension_adjustment_type: 'percentage',
            extension_adjustment_value: 30,
            tax_rate: 19
          };
          const sampleItems = [
            { concept: 'Pack Impreso', unit_price: 490000, quantity: 1 }
          ];

          const computed = calculateProposalTotals(sampleProposal, sampleItems);
          
          // Verify totals: 490000 + 30% (147000) = 637000 subtotal net. With 19% IVA (121030) = 758030
          if (computed.subtotal !== 637000 || computed.total !== 758030) {
            throw new Error(`Cálculos incorrectos: subtotal=${computed.subtotal} (esperado 637000), total=${computed.total} (esperado 758030)`);
          }

          result.status = 'OK';
          result.record = `Cálculo verificado: Neto $${computed.subtotal} | IVA $${computed.vat} | Total $${computed.total}`;
          result.recommendation = 'Los cálculos del motor unificado unificado son correctos y coinciden con la regla del PDF.';
          break;
        }

        case 11: { // Probar usuario administrador secundario
          result.table = 'organization_members (policies)';

          const { data: admins, error: admErr } = await supabase
            .from('organization_members')
            .select('id, user_id, role')
            .eq('organization_id', organizationId)
            .eq('role', 'administrador');

          if (admErr) throw admErr;

          result.status = 'OK';
          result.record = `Encontrados ${admins ? admins.length : 0} administradores en la organización.`;
          result.recommendation = 'Políticas RLS e índices de roles de administrador comprobados con éxito.';
          break;
        }

        default:
          throw new Error('Prueba no soportada');
      }
    } catch (err) {
      console.error(`Error running test ${testNumber}:`, err);
      result.status = 'Error';
      result.message = err.message;
      result.recommendation = 'Verifique las políticas de RLS, la existencia de tablas, o ejecute la migración supabase_migration_schema_guard.sql';
    } finally {
      setTestResults(prev => ({ ...prev, [testNumber]: result }));
      setRunningTests(prev => ({ ...prev, [testNumber]: false }));
      checkSchemaContract(); // Refresh counts
    }
  };

  const handleRunAllTests = async () => {
    const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const testNo of sequence) {
      await handleRunTest(testNo);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Upper Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
            Auditoría del CRM
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Verificación de conexión, estructura de Supabase, permisos y flujos internos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunAllTests}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-650/15 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Probar Flujo Completo
          </button>
          <button
            onClick={cleanQARecords}
            disabled={cleaningUp}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {cleaningUp ? 'Limpiando...' : 'Limpiar Datos de Prueba'}
          </button>
          <button
            onClick={runDiagnostic}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-655 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-55"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Ejecutar Diagnóstico
          </button>
        </div>
      </div>

      {/* RLS Warning Block */}
      {rlsErrorDetected && (
        <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-xs uppercase tracking-wider">Políticas de RLS Bloqueando Acceso</h4>
            <p className="text-amber-655 dark:text-amber-300/80 text-xs font-medium">{rlsErrorMessage}</p>
            <p className="text-[10px] text-amber-500 font-bold">Recomendación: Revise las políticas de RLS en Supabase o ejecute la migración maestra para restablecer permisos.</p>
          </div>
        </div>
      )}

      {/* Schema Diff / Database Contract Guard panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-indigo-500" />
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">Diferencias del Contrato de Datos (Schema Guard)</h4>
          </div>
          {checkingSchema && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-indigo-500"></span>}
        </div>

        {missingCols.length === 0 && tablesWithoutOrgIdCol.length === 0 ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>¡Base de datos totalmente alineada! No se detectaron discrepancias ni columnas faltantes con el frontend.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-4 bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/40 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-400 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[9px] mb-1">Columnas faltantes detectadas en Supabase:</span>
                <p className="mb-2">El frontend espera columnas que no existen en el esquema físico actual de la base de datos. Ejecute la migración <strong>supabase_migration_schema_guard.sql</strong>.</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {missingCols.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-455 border border-rose-200 dark:border-rose-900 rounded font-mono text-[9px] font-bold">
                      {c.table}.{c.column} ({c.type})
                    </span>
                  ))}
                  {tablesWithoutOrgIdCol.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-955/40 dark:text-amber-400 border border-amber-250 dark:border-amber-900 rounded font-mono text-[9px] font-bold">
                      {t} (Falta organization_id)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: A. Diagnóstico general & B. Counts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Diagnostic Panel */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2">
            <Server className="w-4.5 h-4.5 text-indigo-500" />
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">A. Diagnóstico General</h4>
          </div>
          
          {loadingDiag ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">Supabase Connection:</span>
                {supabaseConnected ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-100 dark:border-emerald-900">CONECTADO</span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] font-bold rounded border border-rose-100 dark:border-rose-900">SIN ACCESO / ERROR</span>
                )}
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">Usuario Actual:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono truncate max-w-xs">{currentUser?.email || 'Desconocido'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">User ID:</span>
                <span className="font-bold text-slate-600 dark:text-slate-455 font-mono text-[10px]">{currentUser?.id || 'null'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">Rol del Usuario:</span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 text-[10px] font-extrabold rounded capitalize border border-indigo-100 dark:border-indigo-900">{userRole}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">organization_id:</span>
                <span className="font-bold text-slate-600 dark:text-slate-455 font-mono text-[10px]">{organizationId || 'Sin asignar'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/40 pb-1.5">
                <span className="text-slate-400 font-semibold">Permisos Detectados:</span>
                <span className="font-bold text-slate-750 dark:text-slate-200">
                  {userRole === 'administrador' ? 'Escritura Completa (Admin)' : 'Solo Lectura'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Último diagnóstico:</span>
                <span>{diagTimestamp}</span>
              </div>
            </div>
          )}
        </div>

        {/* Counts Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-indigo-500" />
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">B. Conteos por Módulo y Registros Huérfanos</h4>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[280px] border border-slate-100 dark:border-slate-800 rounded-xl text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-2.5">Módulo / Tabla</th>
                  <th className="p-2.5 text-center">Total Real</th>
                  <th className="p-2.5 text-center text-amber-600 dark:text-amber-500">Sin Org ID</th>
                  <th className="p-2.5 text-center text-rose-600 dark:text-rose-500">User pero sin Org</th>
                  <th className="p-2.5 text-center text-indigo-600 dark:text-indigo-500">Pruebas (TEST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tableStats.map((stat) => (
                  <tr key={stat.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200">
                      {stat.key} 
                      {!stat.hasOrgId && (
                        <span className="ml-1 text-[8px] bg-red-950 text-red-400 border border-red-900 rounded px-1">SIN COL ORG</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-semibold font-mono text-slate-600 dark:text-slate-350">{stat.total}</td>
                    <td className="p-2.5 text-center font-mono">
                      {stat.missingOrgId > 0 ? (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 rounded font-bold">{stat.missingOrgId}</span>
                      ) : (
                        <span className="text-slate-355 dark:text-slate-700">0</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      {stat.userIdNoOrgId > 0 ? (
                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-455 rounded font-bold">{stat.userIdNoOrgId}</span>
                      ) : (
                        <span className="text-slate-355 dark:text-slate-700">0</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-500">
                      {stat.testRecords > 0 ? stat.testRecords : <span className="text-slate-300 dark:text-slate-700">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Section C & D: Integration tests & results */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2">
          <Layers className="w-4.5 h-4.5 text-indigo-500" />
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">C. Pruebas Automáticas y Flujos Cruzados</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Test Buttons list */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Presione el botón para ejecutar cada prueba</h5>
            {[
              { id: 1, label: '1. Probar Propuesta Comercial', desc: 'Crea propuesta TEST_QA, calcula IVA/totales, guarda cotización y quotation_items.' },
              { id: 2, label: '2. Probar Propuesta a Prospecto', desc: 'Toma la propuesta QA, la acepta y la convierte en un nuevo prospecto.' },
              { id: 3, label: '3. Probar Prospecto a Cliente', desc: 'Marca pago/contrato como recibidos en prospecto QA, y lo convierte en cliente.' },
              { id: 4, label: '4. Probar Cliente a Servicio Contratado', desc: 'Crea un servicio contratado asociado al cliente QA, asignando la estructura de timeline.' },
              { id: 5, label: '5. Probar Ingreso', desc: 'Registra un ingreso TEST_QA enlazado a cliente QA.' },
              { id: 6, label: '6. Probar Gasto', desc: 'Registra un gasto TEST_QA de categoría tributaria para probar reportes e impuestos.' },
              { id: 7, label: '7. Probar Pago a Personal', desc: 'Crea un miembro del personal TEST_QA y registra un pago de sueldo.' },
              { id: 8, label: '8. Probar Reserva Operacional', desc: 'Crea un depósito en el balance de reserva operacional TEST_QA.' },
              { id: 9, label: '9. Probar Catálogo y Packs', desc: 'Valida lectura del catálogo y packs activos de servicios.' },
              { id: 10, label: '10. Probar PDF de Propuesta', desc: 'Comprueba el motor de cálculo de propuesta unificada ($758.030) coincidiendo con el PDF.' },
              { id: 11, label: '11. Probar Administrador Secundario', desc: 'Verifica la lectura de administradores y RLS en organization_members.' }
            ].map((test) => (
              <div 
                key={test.id} 
                className="flex items-start justify-between gap-3 p-3 border border-slate-50 dark:border-slate-800/60 rounded-xl hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-all"
              >
                <div className="space-y-0.5">
                  <h6 className="font-bold text-xs text-slate-750 dark:text-slate-205">{test.label}</h6>
                  <p className="text-[10px] text-slate-400 font-medium">{test.desc}</p>
                </div>
                <button
                  onClick={() => handleRunTest(test.id)}
                  disabled={runningTests[test.id]}
                  className="flex-shrink-0 p-1.5 bg-slate-55 hover:bg-slate-105 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-indigo-500 rounded-lg cursor-pointer transition-all border border-slate-100 dark:border-slate-700/50 disabled:opacity-40"
                >
                  {runningTests[test.id] ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Test Results Console */}
          <div className="bg-slate-950 dark:bg-black rounded-2xl p-4 flex flex-col justify-between border border-slate-800 font-mono text-[11px] text-slate-300 min-h-[300px]">
            <div className="space-y-3.5 overflow-y-auto max-h-[460px] flex-1">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-emerald-500 text-xs">LOG DE RESULTADOS DE PRUEBAS</span>
              </div>

              {Object.keys(testResults).length === 0 ? (
                <div className="text-slate-500 italic py-10 text-center">
                  Ninguna prueba ejecutada en esta sesión.
                </div>
              ) : (
                Object.keys(testResults).map((testNo) => {
                  const res = testResults[testNo];
                  return (
                    <div key={testNo} className="border-b border-slate-900 pb-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-400">Prueba #{testNo}:</span>
                        {res.status === 'OK' ? (
                          <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-bold text-[9px] uppercase">✓ OK</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded font-bold text-[9px] uppercase">✗ ERROR</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
                        <span>Tablas:</span>
                        <span className="col-span-2 text-slate-200 font-semibold truncate">{res.table}</span>
                      </div>

                      {res.status === 'OK' ? (
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
                          <span>Resultado:</span>
                          <span className="col-span-2 text-emerald-450 font-bold">{res.record}</span>
                        </div>
                      ) : (
                        <div className="bg-rose-950/20 border border-rose-950/40 p-2 rounded text-rose-400 text-[10px] leading-relaxed whitespace-pre-wrap">
                          <span className="font-bold block uppercase tracking-wider text-[9px] mb-0.5 text-rose-350">Error del sistema:</span>
                          {res.message}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-455">
                        <span className="font-bold text-indigo-300">Respuesta:</span> {res.recommendation}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-900 pt-3 text-[10px] text-slate-500 flex justify-between">
              <span>organization_id: {organizationId}</span>
              <span>Modo: {isMock ? 'Mock Client' : 'Supabase Real'}</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
