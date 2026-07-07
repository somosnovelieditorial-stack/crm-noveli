/**
 * Utility to calculate proposal totals consistently across PDF generation,
 * HTML live previews, forms, and database saves.
 */
export function calculateProposalTotals(proposal, items) {
  const safeProposal = proposal || {};
  const safeItems = items || [];

  // 1. Calculate subtotal (sum of unit_price * quantity)
  const subtotal = safeItems.reduce(
    (sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 1)),
    0
  );

  // 2. Normalize inputs
  const adjType = safeProposal.extension_adjustment_type || '';
  const adjVal = Number(safeProposal.extension_adjustment_value) || 0;
  const discount = Number(safeProposal.discount) || 0;
  
  // Tax rate default is 19%
  let taxRateVal = 19;
  if (
    safeProposal.tax_rate !== undefined &&
    safeProposal.tax_rate !== null &&
    safeProposal.tax_rate !== ''
  ) {
    taxRateVal = Number(safeProposal.tax_rate);
  }
  const rate = taxRateVal / 100;

  const ivaMode = safeProposal.iva_mode || 'Exento / sin IVA';

  // 3. Extension adjustment logic
  const isPercentage =
    adjType === 'percentage' ||
    adjType === 'percent' ||
    adjType === 'Ajuste Porcentaje (%)';

  let adjustmentAmount = 0;
  if (isPercentage) {
    adjustmentAmount = Math.round(subtotal * (adjVal / 100));
  } else {
    adjustmentAmount = adjVal;
  }

  const subtotalAdjusted = subtotal + adjustmentAmount;
  const totalRaw = Math.max(0, subtotalAdjusted - discount);

  // 4. Calculate Net, VAT, and Total based on IVA Mode
  let net = 0;
  let vat = 0;
  let total = 0;

  const isIvaPlus = ivaMode === '+ IVA' || ivaMode === 'plus';
  const isIvaIncluded = ivaMode === 'IVA incluido' || ivaMode === 'included';

  if (isIvaIncluded) {
    total = totalRaw;
    net = Math.round(total / (1 + rate));
    vat = total - net;
  } else if (isIvaPlus) {
    net = totalRaw;
    vat = Math.round(net * rate);
    total = net + vat;
  } else {
    // Exempt / Exento / sin IVA
    net = totalRaw;
    vat = 0;
    total = totalRaw;
  }

  return {
    subtotal,
    adjustmentAmount,
    subtotalAdjusted,
    discount,
    net,
    vat,
    total,
    taxRateVal
  };
}
