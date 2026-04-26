; JavaScript/TypeScript identifier references
; Call expressions
(call_expression
  function: (identifier) @identifier)

(call_expression
  function: (member_expression
    property: (property_identifier) @identifier))

; New expression callee
(new_expression
  callee: (identifier) @identifier)

; Member expression property access
(member_expression
  property: (property_identifier) @identifier)

; Import declarations
(import_statement
  name: (identifier) @identifier)

(import_statement
  default: (identifier) @identifier)

; Export statements
(export_statement
  declaration: (identifier) @identifier)

; Variable declarator right-hand side
(variable_declarator
  name: (identifier) @identifier
  value: (identifier) @identifier)

; Assignment expression right side
(assignment_expression
  right: (identifier) @identifier)

; For in/of statement
(for_in_statement
  left: (identifier) @identifier)

(for_of_statement
  left: (identifier) @identifier)

; Function call arguments
(arguments
  (identifier) @identifier)

; Template string interpolation
(template_substitution
  expression: (identifier) @identifier)

; Type annotation identifiers (TypeScript)
(type_reference
  name: (identifier) @identifier)

(generic_type
  name: (identifier) @identifier)

; Identifier in switch case
(switch_case
  value: (identifier) @identifier)
