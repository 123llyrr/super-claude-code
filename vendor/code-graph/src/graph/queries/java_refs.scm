; Java identifier references
; Method invocation
(method_invocation
  name: (identifier) @identifier)

; Object creation
(class_instance_creation_expression
  type: (type_identifier) @identifier)

; Field access
(field_access
  field: (identifier) @identifier)

; Import declaration
(import_declaration
  (identifier) @identifier)

; Variable declarator initializer
(variable_declarator
  name: (identifier) @identifier
  value: (identifier) @identifier)

; Assignment expression
(assignment
  right: (identifier) @identifier)

; For loop initializer
(for_statement
  init: (identifier) @identifier)

; Enhanced for loop
(for_statement
  left: (identifier) @identifier)

; Method reference
(method_reference
  name: (identifier) @identifier)

; Type reference (in casts, instanceof, etc.)
(type_identifier) @identifier

; Catch clause parameter
(catch_formal_parameter
  name: (identifier) @identifier)

; Lambda expression parameter
(lambda_expression
  parameter: (identifier) @identifier)
