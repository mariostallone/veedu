-- Behaviour tests for 20261118030000_scanning.sql (pantry barcode column).
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@example.com');

set role authenticated;

-- Two separate households
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.create_household('Scan home', 'Esha');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.create_household('Other home', 'Eli');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$
declare
  v_h uuid := (select id from households where name = 'Scan home');
  v_rice uuid;
begin
  -- a barcode can be saved and read back
  insert into pantry_items (household_id, name, barcode) values (v_h, 'Basmati rice', '8901234567890') returning id into v_rice;
  assert (select barcode from pantry_items where id = v_rice) = '8901234567890', 'barcode stored';

  -- items without a barcode are unconstrained
  insert into pantry_items (household_id, name) values (v_h, 'Loose lentils'), (v_h, 'Loose chana');
  assert (select count(*) from pantry_items where barcode is null) = 2, 'many null barcodes allowed';

  -- the same barcode cannot be remembered twice in one household
  begin
    insert into pantry_items (household_id, name, barcode) values (v_h, 'Rice again', '8901234567890');
    assert false, 'duplicate barcode should fail';
  exception when unique_violation then null;
  end;
  begin
    update pantry_items set barcode = '8901234567890' where name = 'Loose lentils';
    assert false, 'duplicate barcode via update should fail';
  exception when unique_violation then null;
  end;

  -- blank barcodes are refused; clearing to null is fine
  begin
    update pantry_items set barcode = '   ' where name = 'Loose lentils';
    assert false, 'blank barcode should fail';
  exception when check_violation then null;
  end;
  update pantry_items set barcode = null where id = v_rice;
  update pantry_items set barcode = '8901234567890' where name = 'Loose lentils';
  assert (select name from pantry_items where barcode = '8901234567890') = 'Loose lentils', 'barcode moved to another item';
end $$;

-- Another household can use the same barcode, and cannot see ours
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
do $$
declare
  v_h uuid := (select id from households where name = 'Other home');
begin
  assert (select count(*) from pantry_items where barcode = '8901234567890') = 0, 'barcode not visible across households';
  insert into pantry_items (household_id, name, barcode) values (v_h, 'My rice', '8901234567890');
  assert (select count(*) from pantry_items where barcode = '8901234567890') = 1, 'same barcode fine in another household';
end $$;
