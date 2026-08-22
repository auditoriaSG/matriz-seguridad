-- Índices de cobertura para llaves foráneas de los módulos de Nexus SK.
-- El bloque sólo crea el índice cuando las columnas FK no son el prefijo
-- de un índice válido existente.

do $$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      n.nspname as schema_name,
      t.relname as table_name,
      c.conname as constraint_name,
      c.conrelid,
      c.conkey,
      string_agg(quote_ident(a.attname), ', ' order by key_column.ordinality) as columns_sql
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join lateral unnest(c.conkey) with ordinality key_column(attnum, ordinality)
      on true
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = key_column.attnum
    where c.contype = 'f'
      and n.nspname in (
        'agenda','auditoria','autorizacion','capacitacion','catalogo',
        'clientes','clinica','configuracion','core','public','rh',
        'seguridad','soporte','stock','ventas'
      )
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and (
            select array_agg(index_column.attnum order by index_column.ordinality)
            from unnest(i.indkey::smallint[]) with ordinality
              index_column(attnum, ordinality)
            where index_column.ordinality <= cardinality(c.conkey)
          ) = c.conkey
      )
    group by n.nspname,t.relname,c.conname,c.conrelid,c.conkey
  loop
    index_name := left(
      'ix_fk_' || fk.schema_name || '_' || fk.table_name || '_' ||
      substr(md5(fk.constraint_name), 1, 8),
      63
    );
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      fk.schema_name,
      fk.table_name,
      fk.columns_sql
    );
  end loop;
end $$;
