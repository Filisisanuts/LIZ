// 通用库存流水计算。旧四类仍沿用原有成本口径；新类型按商品逐笔结转。
function inventoryLedger(item) {
    var opening = Number(item.openingStock) || 0;
    var stock = opening;
    var debt = 0;
    var layers = opening > 0 ? [{ qty: opening, cost: Number(item.openingUnitCost) || 0 }] : [];
    var results = {};
    var entries = (item.transactions || []).slice().sort(function(a, b) {
        var dateOrder = String(a.date || '').localeCompare(String(b.date || ''));
        if (dateOrder) return dateOrder;
        var timeOrder = Number(a.createdAt || 0) - Number(b.createdAt || 0);
        return timeOrder || String(a.id || '').localeCompare(String(b.id || ''));
    });

    function receive(qty, cost) {
        stock += qty;
        var offset = Math.min(debt, qty);
        debt -= offset;
        var available = qty - offset;
        if (available > 0) layers.push({ qty: available, cost: cost });
    }

    function consume(qty) {
        stock -= qty;
        var rest = qty;
        var cost = 0;
        while (rest > 0.000001 && layers.length) {
            var layer = layers[0];
            var used = Math.min(rest, layer.qty);
            cost += used * layer.cost;
            layer.qty -= used;
            rest -= used;
            if (layer.qty < 0.000001) layers.shift();
        }
        if (rest > 0.000001) debt += rest;
        return { cost: Math.round(cost * 100) / 100, pendingQty: Math.round(rest * 1000000) / 1000000 };
    }

    entries.forEach(function(entry) {
        var qty = Number(entry.qty) || 0;
        var kind = entry.kind;
        var result = { cost: 0, pendingQty: 0, amount: Number(entry.amount) || 0 };
        if (kind === 'inbound' || (kind === 'adjust' && qty > 0)) {
            receive(qty, Number(entry.unitCost) || 0);
        } else if (kind === 'sale' || kind === 'return' || kind === 'loss' || (kind === 'adjust' && qty < 0)) {
            result = consume(Math.abs(qty));
            result.amount = kind === 'sale' ? Number(entry.amount) || 0 : 0;
            if (kind === 'sale') result.profit = result.pendingQty > 0 ? null : Math.round((result.amount - result.cost) * 100) / 100;
        }
        results[entry.id] = result;
    });

    return { stock: Math.round(stock * 1000000) / 1000000, results: results, entries: entries };
}
