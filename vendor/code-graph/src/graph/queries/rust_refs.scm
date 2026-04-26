; Rust identifier references - matches identifiers in non-definition contexts
; Excludes: function_item names, struct/enum/union names, const/let names, type names

; Call expressions - function calls
(call_expression
  function: (identifier) @identifier)

; Method calls
(method_call
  method: (identifier) @identifier)

; Field access
(field_expression
  field: (field_identifier) @identifier)

; Use declarations (imports) - the imported name
(use_declaration
  path: (id_identifier) @identifier)

; Type annotations where a type name is used
; e.g., let x: SomeType = ...
(type_annotation
  type: (type_identifier) @identifier)

; Generic type arguments
(type_identifier) @identifier

; Pattern: identifier in struct literal field values
(field_initializer
  value: (identifier) @identifier)

; Macro invocations
(macro_invocation
  macro: (identifier) @identifier)

;turbofish paths: Type::<Type>::method()
(generic_type
  name: (type_identifier) @identifier)

; Assigment right-hand side identifiers
(assignment_expression
  right: (identifier) @identifier)

; Binary expression right side (usually)
(binary_expression
  right: (identifier) @identifier)

; Let declaration initializers
(let_declaration
  value: (identifier) @identifier)

; For loop iterator identifiers
(for_expression
  pattern: (identifier) @identifier)

; Match expression identifiers
(match_pattern
  value: (identifier) @identifier)
