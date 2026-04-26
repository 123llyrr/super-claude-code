; Go identifier references
; Call expressions
(call_expression
  function: (identifier) @identifier)

(call_expression
  function: (selector_expression
    field: (field_identifier) @identifier))

; Selector expression field
(selector_expression
  field: (field_identifier) @identifier)

; Import declaration - imported package name
(import_declaration
  (import_spec
    name: (identifier) @identifier))

; Import path (not really a reference but we include for completeness)
(interpreted_string_literal) @identifier

; Assignment right-hand side
(assignment_statement
  right: (identifier) @identifier)

; Short var declaration
(short_var_declaration
  left: (identifier) @identifier)

; For statement initializer
(for_statement
  init: (identifier) @identifier)

; Range statement
(range_clause
  left: (identifier) @identifier)

; Function parameter reference
(parameter_declaration
  name: (identifier) @identifier)

; Type declaration - type name reference
(type_declaration
  type_spec: (type_identifier) @identifier)

; Type reference in field declaration
(field_declaration
  type: (type_identifier) @identifier)

; Type reference in function return
(function_declaration
  result: (type_identifier) @identifier)

; Type reference in cast expression
(cast_expression
  type: (type_identifier) @identifier)

; Identifier in switch case
(switch_expression
  case: (identifier) @identifier)
