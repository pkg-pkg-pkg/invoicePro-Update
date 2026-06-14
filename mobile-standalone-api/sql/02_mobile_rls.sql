-- Row Level Security policies for MOBILE schema
-- Run as MOBILE schema user with EXECUTE on DBMS_RLS

-- Context package sets CLIENT_IDENTIFIER to parent_user_id on each API request
CREATE OR REPLACE PACKAGE mobile_ctx_pkg AS
  PROCEDURE set_user(p_user_id VARCHAR2);
END mobile_ctx_pkg;
/

CREATE OR REPLACE PACKAGE BODY mobile_ctx_pkg AS
  PROCEDURE set_user(p_user_id VARCHAR2) IS
  BEGIN
    DBMS_SESSION.SET_IDENTIFIER(p_user_id);
  END set_user;
END mobile_ctx_pkg;
/

-- Example policy — repeat for all user-scoped tables
BEGIN
  DBMS_RLS.ADD_POLICY(
    object_schema   => 'MOBILE',
    object_name     => 'SALES_INVOICES',
    policy_name     => 'user_isolation',
    function_schema => 'MOBILE',
    policy_function => 'mobile_rls_fn',
    statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check    => TRUE
  );
END;
/

-- Policy function: child JWT carries parent_user_id; all queries use that as owner key
CREATE OR REPLACE FUNCTION mobile_rls_fn(
  v_schema VARCHAR2, v_table VARCHAR2
) RETURN VARCHAR2 IS
BEGIN
  RETURN 'user_id = SYS_CONTEXT(''USERENV'',''CLIENT_IDENTIFIER'')';
END mobile_rls_fn;
/
