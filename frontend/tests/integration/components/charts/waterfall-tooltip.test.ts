import { describe, it, expect } from 'vitest';

/**
 * Snapshot of the tooltip formatter from analytics.html.
 * Keep this in sync if the inline formatter is edited.
 */
function formatTooltipWithBalance(params: { dataIndex: number }, data: {
    labels: string[]; income: number[]; expense: number[];
    transfers_in: number[]; transfers_out: number[];
    balance: number[]; initial_balance: number; article_id: number | null;
}): string {
    const labelIndex = params.dataIndex;
    const labelsLen = data.labels.length + 2; // 'Начало' + periods + 'Итого'
    if (labelIndex === 0) {
        return `<strong>Начало</strong><br/>Начальный баланс: ${data.initial_balance.toFixed(2)} ₽`;
    }
    if (labelIndex === labelsLen - 1) {
        const finalBalance = data.balance[data.balance.length - 1];
        return `<strong>Итого</strong><br/>Конечный баланс: ${finalBalance.toFixed(2)} ₽`;
    }
    const i = labelIndex - 1;
    const tIn = data.transfers_in[i] ?? 0;
    const tOut = data.transfers_out[i] ?? 0;
    const net = data.income[i] - data.expense[i] + tIn - tOut;
    return `<strong>${data.labels[i]}</strong><br/>`
         + `Доходы: ${data.income[i].toFixed(2)} ₽<br/>`
         + `Расходы: ${data.expense[i].toFixed(2)} ₽<br/>`
         + `Пополнение: ${tIn.toFixed(2)} ₽<br/>`
         + `Списание: ${tOut.toFixed(2)} ₽<br/>`
         + `<hr style="margin: 5px 0"/>`
         + `Чистый поток: <span style="color: ${net >= 0 ? '#4CAF50' : '#f44336'}">${net.toFixed(2)} ₽</span><br/>`
         + `Накопительный итог: ${data.balance[i].toFixed(2)} ₽`;
}

describe('Waterfall tooltip', () => {
    const data = {
        labels: ['Окт'],
        income: [50000],
        expense: [10000],
        transfers_in: [3000],
        transfers_out: [1000],
        balance: [42000],
        initial_balance: 0,
        article_id: null,
    };

    it('renders 5 rows for period bar (with_balance mode)', () => {
        const html = formatTooltipWithBalance({ dataIndex: 1 }, data);
        expect(html).toContain('Доходы: 50000.00');
        expect(html).toContain('Расходы: 10000.00');
        expect(html).toContain('Пополнение: 3000.00');
        expect(html).toContain('Списание: 1000.00');
        expect(html).toContain('Накопительный итог: 42000.00');
    });

    it('computes net = income - expense + transfers_in - transfers_out', () => {
        const html = formatTooltipWithBalance({ dataIndex: 1 }, data);
        // 50000 - 10000 + 3000 - 1000 = 42000
        expect(html).toContain('Чистый поток: <span style="color: #4CAF50">42000.00 ₽</span>');
    });

    it('renders start label at dataIndex 0', () => {
        expect(formatTooltipWithBalance({ dataIndex: 0 }, data))
            .toContain('Начальный баланс: 0.00');
    });

    it('renders total label at last index', () => {
        expect(formatTooltipWithBalance({ dataIndex: 2 }, data))
            .toContain('Конечный баланс: 42000.00');
    });
});
