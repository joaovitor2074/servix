export type OrdenServicos = {
    numeroAutomatico:number
    cliente:string
    equipamento?:string
    descricaoDoProblema?:string
    diagnostico?:string
    servicoRealizado:boolean
    pecasUltilizadas?:string
    tecnicoResponsavel:string
    previsaoDeEntrega?:Date
    valortotal:string
    formaDePagamento?:string
    observacoesinternas?:string
    fotos?:string    
}