import { describe, expect, it } from 'vitest'
import * as CSS from './css-parser'

const css = String.raw

describe.each(['Unix', 'Windows'])('Line endings: %s', (lineEndings) => {
  function parse(string: string) {
    return CSS.parse(string.replaceAll(/\r?\n/g, lineEndings === 'Windows' ? '\r\n' : '\n'))
  }

  describe('comments', () => {
    it('should parse a comment and ignore it', () => {
      expect(
        parse(css`
          /*Hello, world!*/
        `),
      ).toEqual([])
    })

    it('should parse a comment with an escaped ending and ignore it', () => {
      expect(
        parse(css`
          /*Hello, \*\/ world!*/
        `),
      ).toEqual([])
    })

    it('should parse a comment inside of a selector and ignore it', () => {
      expect(
        parse(css`
          .foo {
            /*Example comment*/
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [],
        },
      ])
    })

    it('should remove comments in between selectors while maintaining the correct whitespace', () => {
      expect(
        parse(css`
          .foo/*.bar*/.baz {
          }
          .foo/*.bar*//*.baz*/.qux
          {
          }
          .foo/*.bar*/ /*.baz*/.qux {
            /*        ^ whitespace */
          }
          .foo /*.bar*/.baz {
            /*^ whitespace */
          }
          .foo/*.bar*/ .baz {
            /*        ^ whitespace */
          }
          .foo/*.bar*/
          .baz {
          }
        `),
      ).toEqual([
        { kind: 'rule', source: [], destination: [], selector: '.foo.baz', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '.foo.qux', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '.foo .qux', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '.foo .baz', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '.foo .baz', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '.foo .baz', nodes: [] },
      ])
    })

    it('should collect license comments', () => {
      expect(
        parse(css`
          /*! License #1 */
          /*!
            * License #2
            */
        `),
      ).toEqual([
        { kind: 'comment', source: [], destination: [], value: '! License #1 ' },
        {
          kind: 'comment',
          source: [],
          destination: [],
          value: `!
            * License #2
            `,
        },
      ])
    })

    it('should hoist all license comments', () => {
      expect(
        parse(css`
          /*! License #1 */
          .foo {
            color: red; /*! License #1.5 */
          }
          /*! License #2 */
          .bar {
            /*! License #2.5 */
            color: blue;
          }
          /*! License #3 */
        `),
      ).toEqual([
        { kind: 'comment', source: [], destination: [], value: '! License #1 ' },
        { kind: 'comment', source: [], destination: [], value: '! License #1.5 ' },
        { kind: 'comment', source: [], destination: [], value: '! License #2 ' },
        { kind: 'comment', source: [], destination: [], value: '! License #2.5 ' },
        { kind: 'comment', source: [], destination: [], value: '! License #3 ' },
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
          ],
        },
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.bar',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'blue',
              important: false,
            },
          ],
        },
      ])
    })

    it('should handle comments before element selectors', () => {
      expect(
        parse(css`
          .dark /* comment */p {
            color: black;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.dark p',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'black',
              important: false,
            },
          ],
        },
      ])
    })
  })

  describe('declarations', () => {
    it('should parse a simple declaration', () => {
      expect(
        parse(css`
          color: red;
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'color',
          value: 'red',
          important: false,
        },
      ])
    })

    it('should parse declarations with strings', () => {
      expect(
        parse(css`
          content: 'Hello, world!';
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'content',
          value: "'Hello, world!'",
          important: false,
        },
      ])
    })

    it('should parse declarations with nested strings', () => {
      expect(
        parse(css`
          content: 'Good, "monday", morning!';
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'content',
          value: `'Good, "monday", morning!'`,
          important: false,
        },
      ])
    })

    it('should parse declarations with nested strings that are not balanced', () => {
      expect(
        parse(css`
          content: "It's a beautiful day!";
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'content',
          value: `"It's a beautiful day!"`,
          important: false,
        },
      ])
    })

    it('should parse declarations with with strings and escaped string endings', () => {
      expect(
        parse(css`
          content: 'These are not the end "\' of the string';
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'content',
          value: `'These are not the end \"\\' of the string'`,
          important: false,
        },
      ])
    })

    describe('important', () => {
      it('should parse declarations with `!important`', () => {
        expect(
          parse(css`
            width: 123px !important;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: 'width',
            value: '123px',
            important: true,
          },
        ])
      })

      it('should parse declarations with `!important` when there is a trailing comment', () => {
        expect(
          parse(css`
            width: 123px !important /* Very important */;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: 'width',
            value: '123px',
            important: true,
          },
        ])
      })
    })

    describe('Custom properties', () => {
      it('should parse a custom property', () => {
        expect(
          parse(css`
            --foo: bar;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'bar',
            important: false,
          },
        ])
      })

      it('should parse a minified custom property', () => {
        expect(parse(':root{--foo:bar;}')).toEqual([
          {
            kind: 'rule',
            source: [],
            destination: [],
            selector: ':root',
            nodes: [
              {
                kind: 'declaration',
                source: [],
                destination: [],
                property: '--foo',
                value: 'bar',
                important: false,
              },
            ],
          },
        ])
      })

      it('should parse a minified custom property with no semicolon ', () => {
        expect(parse(':root{--foo:bar}')).toEqual([
          {
            kind: 'rule',
            source: [],
            destination: [],
            selector: ':root',
            nodes: [
              {
                kind: 'declaration',
                source: [],
                destination: [],
                property: '--foo',
                value: 'bar',
                important: false,
              },
            ],
          },
        ])
      })

      it('should parse a custom property with a missing ending `;`', () => {
        expect(
          parse(`
            --foo: bar
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'bar',
            important: false,
          },
        ])
      })

      it('should parse a custom property with a missing ending `;` and `!important`', () => {
        expect(
          parse(`
            --foo: bar !important
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'bar',
            important: true,
          },
        ])
      })

      it('should parse a custom property with an embedded programming language', () => {
        expect(
          parse(css`
            --foo: if(x > 5) this.width = 10;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'if(x > 5) this.width = 10',
            important: false,
          },
        ])
      })

      it('should parse a custom property with an empty block as the value', () => {
        expect(parse('--foo: {};')).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: '{}',
            important: false,
          },
        ])
      })

      it('should parse a custom property with a block including nested "css"', () => {
        expect(
          parse(css`
            --foo: {
              background-color: red;
              /* A comment */
              content: 'Hello, world!';
            };
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: `{
              background-color: red;
              /* A comment */
              content: 'Hello, world!';
            }`,
            important: false,
          },
        ])
      })

      it('should parse a custom property with a block including nested "css" and comments with end characters inside them', () => {
        expect(
          parse(css`
            --foo: {
              background-color: red;
              /* A comment ; */
              content: 'Hello, world!';
            };
            --bar: {
              background-color: red;
              /* A comment } */
              content: 'Hello, world!';
            };
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: `{
              background-color: red;
              /* A comment ; */
              content: 'Hello, world!';
            }`,
            important: false,
          },
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--bar',
            value: `{
              background-color: red;
              /* A comment } */
              content: 'Hello, world!';
            }`,
            important: false,
          },
        ])
      })

      it('should parse a custom property with escaped characters in the value', () => {
        expect(
          parse(css`
            --foo: This is not the end \;, but this is;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'This is not the end \\;, but this is',
            important: false,
          },
        ])
      })

      it('should parse a custom property with escaped characters inside a comment in the value', () => {
        expect(
          parse(css`
            --foo: /* This is not the end \; this is also not the end ; */ but this is;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: '/* This is not the end \\; this is also not the end ; */ but this is',
            important: false,
          },
        ])
      })

      it('should parse empty custom properties', () => {
        expect(
          parse(css`
            --foo: ;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: '',
            important: false,
          },
        ])
      })

      it('should parse custom properties with `!important`', () => {
        expect(
          parse(css`
            --foo: bar !important;
          `),
        ).toEqual([
          {
            kind: 'declaration',
            source: [],
            destination: [],
            property: '--foo',
            value: 'bar',
            important: true,
          },
        ])
      })
    })

    it('should parse multiple declarations', () => {
      expect(
        parse(css`
          color: red;
          background-color: blue;
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'color',
          value: 'red',
          important: false,
        },
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'background-color',
          value: 'blue',
          important: false,
        },
      ])
    })

    /**
     *
     */
    it('should correctly parse comments with `:` inside of them', () => {
      expect(
        parse(css`
          color/* color: #f00; */: red;
          font-weight:/* font-size: 12px */ bold;

          .foo {
            background-color/* background-color: #f00; */: red;
          }
        `),
      ).toEqual([
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'color',
          value: 'red',
          important: false,
        },
        {
          kind: 'declaration',
          source: [],
          destination: [],
          property: 'font-weight',
          value: 'bold',
          important: false,
        },
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'background-color',
              value: 'red',
              important: false,
            },
          ],
        },
      ])
    })

    it('should parse multi-line declarations', () => {
      expect(
        parse(css`
          .foo {
            grid-template-areas:
              'header header header'
              'sidebar main main'
              'footer footer footer';
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'grid-template-areas',
              value: "'header header header' 'sidebar main main' 'footer footer footer'",
              important: false,
            },
          ],
        },
      ])
    })
  })

  describe('selectors', () => {
    it('should parse a simple selector', () => {
      expect(
        parse(css`
          .foo {
          }
        `),
      ).toEqual([{ kind: 'rule', source: [], destination: [], selector: '.foo', nodes: [] }])
    })

    it('should parse selectors with escaped characters', () => {
      expect(
        parse(css`
          .hover\:foo:hover {
          }
          .\32 xl\:foo {
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.hover\\:foo:hover',
          nodes: [],
        },
        { kind: 'rule', source: [], destination: [], selector: '.\\32 xl\\:foo', nodes: [] },
      ])
    })

    it('should parse multiple simple selectors', () => {
      expect(
        parse(css`
          .foo,
          .bar {
          }
        `),
      ).toEqual([{ kind: 'rule', source: [], destination: [], selector: '.foo, .bar', nodes: [] }])
    })

    it('should parse multiple declarations inside of a selector', () => {
      expect(
        parse(css`
          .foo {
            color: red;
            font-size: 16px;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'font-size',
              value: '16px',
              important: false,
            },
          ],
        },
      ])
    })

    it('should parse rules with declarations that end with a missing `;`', () => {
      expect(
        parse(`
          .foo {
            color: red;
            font-size: 16px
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'font-size',
              value: '16px',
              important: false,
            },
          ],
        },
      ])
    })

    it('should parse rules with declarations that end with a missing `;` and `!important`', () => {
      expect(
        parse(`
          .foo {
            color: red;
            font-size: 16px !important
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'font-size',
              value: '16px',
              important: true,
            },
          ],
        },
      ])
    })

    it('should parse a multi-line selector', () => {
      expect(parse(['.foo,', '.bar,', '.baz', '{', 'color:red;', '}'].join('\n'))).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo, .bar, .baz',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
          ],
        },
      ])
    })

    it('should parse a multi-line selector and preserves important whitespace', () => {
      expect(
        parse(['.foo,', '.bar,', '.baz\t\n \n .qux', '{', 'color:red;', '}'].join('\n')),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo, .bar, .baz .qux',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
          ],
        },
      ])
    })
  })

  describe('at-rules', () => {
    it('should parse an at-rule without a block', () => {
      expect(
        parse(css`
          @charset "UTF-8";
        `),
      ).toEqual([
        { kind: 'rule', source: [], destination: [], selector: '@charset "UTF-8"', nodes: [] },
      ])
    })

    it("should parse an at-rule without a block or semicolon when it's the last rule in a block", () => {
      expect(
        parse(`
          @layer utilities {
            @tailwind utilities
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '@layer utilities',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '@tailwind utilities',
              nodes: [],
            },
          ],
        },
      ])
    })

    it('should parse a nested at-rule without a block', () => {
      expect(
        parse(css`
          @layer utilities {
            @charset "UTF-8";
          }

          .foo {
            @apply font-bold hover:text-red-500;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '@layer utilities',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '@charset "UTF-8"',
              nodes: [],
            },
          ],
        },
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '@apply font-bold hover:text-red-500',
              nodes: [],
            },
          ],
        },
      ])
    })

    it('should parse custom at-rules without a block', () => {
      expect(
        parse(css`
          @tailwind;
          @tailwind base;
        `),
      ).toEqual([
        { kind: 'rule', source: [], destination: [], selector: '@tailwind', nodes: [] },
        { kind: 'rule', source: [], destination: [], selector: '@tailwind base', nodes: [] },
      ])
    })

    it('should parse (nested) media queries', () => {
      expect(
        parse(css`
          @media (width >= 600px) {
            .foo {
              color: red;
              @media (width >= 800px) {
                color: blue;
              }
              @media (width >= 1000px) {
                color: green;
              }
            }
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '@media (width >= 600px)',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.foo',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'red',
                  important: false,
                },
                {
                  kind: 'rule',
                  source: [],
                  destination: [],
                  selector: '@media (width >= 800px)',
                  nodes: [
                    {
                      kind: 'declaration',
                      source: [],
                      destination: [],
                      property: 'color',
                      value: 'blue',
                      important: false,
                    },
                  ],
                },
                {
                  kind: 'rule',
                  source: [],
                  destination: [],
                  selector: '@media (width >= 1000px)',
                  nodes: [
                    {
                      kind: 'declaration',
                      source: [],
                      destination: [],
                      property: 'color',
                      value: 'green',
                      important: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })

    it('should parse at-rules that span multiple lines', () => {
      expect(
        parse(css`
          .foo {
            @apply hover:text-red-100
                   sm:hover:text-red-200
                   md:hover:text-red-300
                   lg:hover:text-red-400
                   xl:hover:text-red-500;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              nodes: [],
              selector:
                '@apply hover:text-red-100 sm:hover:text-red-200 md:hover:text-red-300 lg:hover:text-red-400 xl:hover:text-red-500',
            },
          ],
          selector: '.foo',
        },
      ])
    })
  })

  describe('nesting', () => {
    it('should parse nested rules', () => {
      expect(
        parse(css`
          .foo {
            .bar {
              .baz {
                color: red;
              }
            }
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.bar',
              nodes: [
                {
                  kind: 'rule',
                  source: [],
                  destination: [],
                  selector: '.baz',
                  nodes: [
                    {
                      kind: 'declaration',
                      source: [],
                      destination: [],
                      property: 'color',
                      value: 'red',
                      important: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })

    it('should parse nested selector with `&`', () => {
      expect(
        parse(css`
          .foo {
            color: red;

            &:hover {
              color: blue;
            }
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '&:hover',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'blue',
                  important: false,
                },
              ],
            },
          ],
        },
      ])
    })

    it('should parse nested sibling selectors', () => {
      expect(
        parse(css`
          .foo {
            .bar {
              color: red;
            }

            .baz {
              color: blue;
            }
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.bar',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'red',
                  important: false,
                },
              ],
            },
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.baz',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'blue',
                  important: false,
                },
              ],
            },
          ],
        },
      ])
    })

    it('should parse nested sibling selectors and sibling declarations', () => {
      expect(
        parse(css`
          .foo {
            font-weight: bold;
            text-declaration-line: underline;

            .bar {
              color: red;
            }

            --in-between: 1;

            .baz {
              color: blue;
            }

            --at-the-end: 2;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'font-weight',
              value: 'bold',
              important: false,
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'text-declaration-line',
              value: 'underline',
              important: false,
            },
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.bar',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'red',
                  important: false,
                },
              ],
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: '--in-between',
              value: '1',
              important: false,
            },
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '.baz',
              nodes: [
                {
                  kind: 'declaration',
                  source: [],
                  destination: [],
                  property: 'color',
                  value: 'blue',
                  important: false,
                },
              ],
            },
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: '--at-the-end',
              value: '2',
              important: false,
            },
          ],
        },
      ])
    })
  })

  describe('complex', () => {
    it('should parse complex examples', () => {
      expect(
        parse(css`
          @custom \{ {
            foo: bar;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '@custom \\{',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'foo',
              value: 'bar',
              important: false,
            },
          ],
        },
      ])
    })

    it('should parse minified nested CSS', () => {
      expect(
        parse('.foo{color:red;@media(width>=600px){.bar{color:blue;font-weight:bold}}}'),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
            {
              kind: 'rule',
              source: [],
              destination: [],
              selector: '@media(width>=600px)',
              nodes: [
                {
                  kind: 'rule',
                  source: [],
                  destination: [],
                  selector: '.bar',
                  nodes: [
                    {
                      kind: 'declaration',
                      source: [],
                      destination: [],
                      property: 'color',
                      value: 'blue',
                      important: false,
                    },
                    {
                      kind: 'declaration',
                      source: [],
                      destination: [],
                      property: 'font-weight',
                      value: 'bold',
                      important: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })

    it('should ignore everything inside of comments', () => {
      expect(
        parse(css`
          .foo:has(.bar /* instead \*\/ of .baz { */) {
            color: red;
          }
        `),
      ).toEqual([
        {
          kind: 'rule',
          source: [],
          destination: [],
          selector: '.foo:has(.bar )',
          nodes: [
            {
              kind: 'declaration',
              source: [],
              destination: [],
              property: 'color',
              value: 'red',
              important: false,
            },
          ],
        },
      ])
    })
  })

  describe('errors', () => {
    it('should error when curly brackets are unbalanced (opening)', () => {
      expect(() =>
        parse(`
          .foo {
            color: red;
          }

          .bar
            /* ^ Missing opening { */
            color: blue;
          }
        `),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Missing opening {]`)
    })

    it('should error when curly brackets are unbalanced (closing)', () => {
      expect(() =>
        parse(`
          .foo {
            color: red;
          }

          .bar {
            color: blue;

       /* ^ Missing closing } */
        `),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Missing closing } at .bar]`)
    })

    it('should error when an unterminated string is used', () => {
      expect(() =>
        parse(css`
          .foo {
            content: "Hello world!
            /*                    ^ missing " */
            font-weight: bold;
          }
        `),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Unterminated string: "Hello world!"]`)
    })

    it('should error when an unterminated string is used with a `;`', () => {
      expect(() =>
        parse(css`
          .foo {
            content: "Hello world!;
            /*                    ^ missing " */
            font-weight: bold;
          }
        `),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Unterminated string: "Hello world!;"]`)
    })
  })
})
