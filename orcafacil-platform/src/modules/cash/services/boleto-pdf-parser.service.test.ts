import { describe, expect, it } from 'vitest';
import {
  parseBoletoText,
  parseBoletoPdf,
} from './boleto-pdf-parser.service';

describe('boleto-pdf-parser.service', () => {
  it('deve extrair dados de boleto bancário FEBRABAN de 47 dígitos com fator de vencimento', () => {
    // Linha digitável bancária válida (Banco do Brasil 001)
    // Bloco 5: Fator 1000 (22/02/2025) + 10 dígitos de valor = 0000015000 (R$ 150,00)
    const rawText = `
      BANCO DO BRASIL S.A.
      00190.00009 01234.567802 01234.567803 1 10000000015000
      Beneficiário: CEMIG DISTRIBUICAO S.A.
      CNPJ: 06.981.180/0001-16
      Vencimento: 22/02/2025
      Valor do Documento: R$ 150,00
    `;

    const result = parseBoletoText(rawText, 'boleto_cemig.pdf');

    expect(result.barcode).toBe('00190000090123456780201234567803110000000015000');
    expect(result.amount).toBe(150);
    expect(result.dueDate).toBe('2025-02-22');
    expect(result.beneficiaryName).toMatch(/cemig/i);
    expect(result.suggestedCategory).toBe('Luz');
  });

  it('deve extrair boleto de concessionária de 48 dígitos (Copasa - Água)', () => {
    // 826 = saneamento/água, valor R$ 85,50
    const rawText = `
      COPASA - COMPANHIA DE SANEAMENTO DE MINAS GERAIS
      826200000008 855000240212 900000000003 000000000004
      Vencimento: 15/03/2025
      Total a Pagar: R$ 85,50
    `;

    const result = parseBoletoText(rawText, 'copasa_fatura.pdf');

    expect(result.suggestedCategory).toBe('Água');
    expect(result.beneficiaryName).toMatch(/copasa/i);
    expect(result.amount).toBe(85.5);
    expect(result.dueDate).toBe('2025-03-15');
  });

  it('deve reconhecer fatura de Internet (Claro / Net)', () => {
    const rawText = `
      CLARO S.A. - FATURA DE SERVICOS DE INTERNET BANDA LARGA
      846700000019 129900012345 678900000001 234567890002
      Vencimento: 10/04/2025
      Valor a pagar: 129,90
    `;

    const result = parseBoletoText(rawText, 'fatura_claro_net.pdf');

    expect(result.suggestedCategory).toBe('Internet');
    expect(result.beneficiaryName).toMatch(/claro/i);
    expect(result.amount).toBe(129.9);
    expect(result.dueDate).toBe('2025-04-10');
  });

  it('deve inferir categoria e nome pelo nome do arquivo caso o texto seja escasso', () => {
    const rawText = `DOCUMENTO DE COBRANCA Vencimento 05/05/2025 Valor R$ 320,00`;
    const result = parseBoletoText(rawText, 'Boleto_Sabesp_Agua_Maio.pdf');

    expect(result.suggestedCategory).toBe('Água');
    expect(result.beneficiaryName).toMatch(/sabesp/i);
    expect(result.amount).toBe(320);
    expect(result.dueDate).toBe('2025-05-05');
  });

  it('deve lançar erro descritivo ao tentar ler bytes corrompidos ou vazios', async () => {
    const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(parseBoletoPdf(invalidBytes, 'danificado.pdf')).rejects.toThrow(
      'O arquivo PDF enviado está vazio ou inválido.'
    );
  });
});
