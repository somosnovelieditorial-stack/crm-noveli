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

  const ivaMode = safeProposal.iva_mode || (safeProposal.includes_iva ? 'IVA incluido' : 'Exento / sin IVA');

  // 3. Extension adjustment logic
  const isPercentage =
    adjType === 'percentage' ||
    adjType === 'percent' ||
    adjType === 'porcentaje' ||
    adjType === 'Ajuste Porcentaje (%)' ||
    String(adjType).toLowerCase().includes('percent') ||
    String(adjType).toLowerCase().includes('porcent');

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

  // 5. Generate rows array
  const rows = safeItems.map((item, idx) => {
    const itemNetTotal = Number(item.unit_price || 0) * Number(item.quantity || 1);
    let itemNet = 0;
    let itemVat = 0;
    let itemTotal = 0;

    if (isIvaIncluded) {
      itemNet = Math.round(itemNetTotal / (1 + rate));
      itemVat = itemNetTotal - itemNet;
      itemTotal = itemNetTotal;
    } else if (isIvaPlus) {
      itemNet = itemNetTotal;
      itemVat = Math.round(itemNet * rate);
      itemTotal = itemNet + itemVat;
    } else {
      itemNet = itemNetTotal;
      itemVat = 0;
      itemTotal = itemNetTotal;
    }

    return {
      id: item.id || `item-${idx}`,
      concept: item.concept,
      quantity: Number(item.quantity) || 1,
      net: itemNet,
      vat: itemVat,
      total: itemTotal
    };
  });

  if (adjustmentAmount !== 0) {
    let adjNet = 0;
    let adjVat = 0;
    let adjTotal = 0;

    if (isIvaIncluded) {
      adjNet = Math.round(adjustmentAmount / (1 + rate));
      adjVat = adjustmentAmount - adjNet;
      adjTotal = adjustmentAmount;
    } else if (isIvaPlus) {
      adjNet = adjustmentAmount;
      adjVat = Math.round(adjNet * rate);
      adjTotal = adjNet + adjVat;
    } else {
      adjNet = adjustmentAmount;
      adjVat = 0;
      adjTotal = adjustmentAmount;
    }

    const pages = Number(safeProposal.manuscript_pages) || 0;
    const adjustmentLabel = isPercentage
      ? `Ajuste por extensión (${pages} pág. / ${adjVal}%)`
      : `Ajuste por extensión (${pages} pág.)`;

    rows.push({
      id: 'adjustment-row',
      concept: adjustmentLabel,
      quantity: 1,
      net: adjNet,
      vat: adjVat,
      total: adjTotal
    });
  }

  if (discount !== 0) {
    let discNet = 0;
    let discVat = 0;
    let discTotal = 0;

    if (isIvaIncluded) {
      discNet = Math.round(discount / (1 + rate));
      discVat = discount - discNet;
      discTotal = discount;
    } else if (isIvaPlus) {
      discNet = discount;
      discVat = Math.round(discNet * rate);
      discTotal = discNet + discVat;
    } else {
      discNet = discount;
      discVat = 0;
      discTotal = discount;
    }

    rows.push({
      id: 'discount-row',
      concept: `Descuento aplicado`,
      quantity: 1,
      net: -discNet,
      vat: -discVat,
      total: -discTotal
    });
  }

  return {
    subtotal,
    netSubtotal: subtotal,
    adjustmentAmount,
    extensionAdjustmentAmount: adjustmentAmount,
    discount,
    net,
    vat,
    taxAmount: vat,
    total,
    rows,
    taxRateVal
  };
}
