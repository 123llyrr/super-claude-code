; Python identifier references
; Call expressions
(call
  function: (identifier) @identifier)

; Attribute calls
(attribute
  attribute: (identifier) @identifier)

; Import statements - imported names
(import_statement
  name: (identifier) @identifier)

(import_from_statement
  name: (identifier) @identifier)

; Type annotations (Python 3.5+)
(subscript
  value: (identifier) @identifier)

; Assignment right-hand side
(assignment
  right: (identifier) @identifier)

; Named expression (walrus operator)
(named_expression
  value: (identifier) @identifier)

; For loop target
(for_statement
  target: (identifier) @identifier)

; With statement
(with_statement
  item: (identifier) @identifier)

; Except handler
(except_clause
  name: (identifier) @identifier)

; Function definition parameters (references in body)
(identifier) @identifier
