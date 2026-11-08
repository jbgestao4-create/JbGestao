import * as XLSX from 'xlsx'
import type { ImportModule } from '../types/import.types'

export class TemplateGeneratorService {
  /**
   * Gera e dispara o download do modelo oficial (.xlsx) de cada módulo
   */
  static downloadTemplate(module: ImportModule) {
    let filename = `modelo_importacao_${module}.xlsx`
    let sheetName = 'Modelo'
    let data: Record<string, any>[] = []

    switch (module) {
      case 'customers':
        sheetName = 'Clientes'
        filename = 'modelo_importacao_clientes.xlsx'
        data = [
          {
            nome: 'João da Silva',
            tipo_pessoa: 'F', // F = Física, J = Jurídica
            cpf_cnpj: '123.456.789-00',
            email: 'joao.silva@exemplo.com',
            telefone: '(11) 98765-4321',
            cep: '01001-000',
            endereco: 'Praça da Sé',
            numero: '100',
            observacoes: 'Cliente VIP - Atendimento preferencial'
          },
          {
            nome: 'Indústria ABC Comércio Ltda',
            tipo_pessoa: 'J',
            cpf_cnpj: '12.345.678/0001-90',
            email: 'contato@industriaabc.com.br',
            telefone: '(11) 3214-5500',
            cep: '04538-133',
            endereco: '', // Ao deixar em branco, o endereço é buscado automaticamente pelo CEP via API
            numero: '2500',
            observacoes: 'Endereço autocompletado pelo CEP'
          }
        ]
        break

      case 'suppliers':
        sheetName = 'Fornecedores'
        filename = 'modelo_importacao_fornecedores.xlsx'
        data = [
          {
            razao_social: 'Metalúrgica Brasil Ltda',
            cnpj: '98.765.432/0001-10',
            contato_responsavel: 'Carlos Eduardo',
            telefone: '(11) 99887-1122',
            email: 'compras@metalurgicabrasil.com.br',
            endereco: 'Rua das Indústrias, 500 - São Paulo/SP',
            observacoes: 'Prazo médio de entrega: 5 dias'
          },
          {
            razao_social: 'Distribuidora Ferramentas Express ME',
            cnpj: '11.222.333/0001-44',
            contato_responsavel: 'Ana Souza',
            telefone: '(19) 3456-7890',
            email: 'vendas@ferramentasexpress.com',
            endereco: 'Av. Brasil, 120 - Campinas/SP',
            observacoes: 'Desconto de 5% para pagamento via PIX'
          }
        ]
        break

      case 'inventory':
        sheetName = 'Estoque'
        filename = 'modelo_importacao_estoque.xlsx'
        data = [
          {
            nome_produto: 'Parafuso Sextavado Aço Inox 3/8',
            codigo_barras: '7891234567890',
            categoria: 'Fixadores',
            unidade_medida: 'UN',
            preco_venda: 2.5,
            preco_custo: 1.1,
            estoque_atual: 450,
            estoque_minimo: 50,
            fornecedor: 'Metalúrgica Brasil Ltda'
          },
          {
            nome_produto: 'Chave Philips Emborrachada 6x150mm',
            codigo_barras: '7899876543210',
            categoria: 'Ferramentas Manuais',
            unidade_medida: 'UN',
            preco_venda: 24.9,
            preco_custo: 12.0,
            estoque_atual: 35,
            estoque_minimo: 10,
            fornecedor: 'Distribuidora Ferramentas Express ME'
          }
        ]
        break

      case 'sales':
        sheetName = 'Vendas'
        filename = 'modelo_importacao_vendas.xlsx'
        data = [
          {
            numero_pedido: 'PED-101',
            cliente_doc_ou_nome: 'João da Silva',
            codigo_produto: 'PROD-1001',
            quantidade: 10,
            preco_unitario: 2.5,
            desconto: 0,
            forma_pagamento: 'pix', // dinheiro, pix, credit_card, debit_card, on_credit
            data_venda: '2026-11-01',
            observacoes: 'Venda balcão'
          },
          {
            numero_pedido: 'PED-101',
            cliente_doc_ou_nome: 'João da Silva',
            codigo_produto: 'PROD-1002',
            quantidade: 1,
            preco_unitario: 24.9,
            desconto: 2.4,
            forma_pagamento: 'pix',
            data_venda: '2026-11-01',
            observacoes: 'Item 2 do mesmo pedido PED-101'
          }
        ]
        break

      case 'budgets':
        sheetName = 'Orcamentos'
        filename = 'modelo_importacao_orcamentos.xlsx'
        data = [
          {
            numero_orcamento: 'ORC-201',
            cliente_doc_ou_nome: 'Indústria ABC Comércio Ltda',
            codigo_produto: 'PROD-1001',
            quantidade: 100,
            preco_unitario: 2.3,
            desconto: 10,
            validade_dias: 15,
            observacoes: 'Cotação para manutenção industrial'
          }
        ]
        break
    }

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    XLSX.writeFile(workbook, filename)
  }

  /**
   * Exporta uma planilha com apenas as linhas que falharam, contendo uma coluna especial MOTIVO_DO_ERRO
   */
  static exportErrorsSpreadsheet(rejectedRows: Record<string, any>[], module: ImportModule) {
    if (!rejectedRows.length) return

    const worksheet = XLSX.utils.json_to_sheet(rejectedRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Falhas_Para_Correcao')

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    XLSX.writeFile(workbook, `erros_importacao_${module}_${dateStr}.xlsx`)
  }
}
