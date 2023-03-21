/**
 *
 * matchTree({ a: 1 }, { a: 1, b: 1 }) // true
 * matchTree({ c: 1 }, { a: 1, b: 1 }) // false
 * === split values ===
 * matchTree({ '[]a': [1,2] }, { a: 1 }) // true
 * matchTree({ '[]a': [1,2] }, { a: 2 }) // true
 * matchTree({ '[]a': [1,2] }, { a: 3 }) // false
 * === split keys ===
 * matchTree({ '[a,b]': 1 }, { a: 1 }) // true
 * matchTree({ '[a,b]': 1 }, { b: 1 }) // true
 * matchTree({ '[a,b]': 1 }, { c: 1 }) // false
 *
 * === split values and split keys
 * eg. { '[][a,b]': [1, 2]  }
 */
function matchTree(template, ast, isSplitValues) {
  if (typeof template !== 'object') {
    if (template !== ast) {
      return false;
    }
  } else {
    if (isSplitValues) {
      if (!Array.isArray(template)) {
        return false;
      }
      let match = false;
      for (const child of template) {
        if (matchTree(child, ast)) {
          match = true;
          break;
        }
      }
      if (!match) {
        return false;
      }
    } else {
      if (typeof ast !== 'object') {
        return false;
      }
      for (const key in template) {
        let isSplitValues = false;
        let realKey = key;
        if (key.startsWith('[]')) {
          isSplitValues = true;
          realKey = key.replace(/^\[\]/, '');
        }

        let splitKeys = [];
        let matchSplitKeys;
        if ((matchSplitKeys = realKey.match(/^\[([^\]]+)\]$/))) {
          splitKeys = matchSplitKeys[1].split(/\s*,\s*/);
        }

        if (matchSplitKeys) {
          let match = false;
          for (const childKey of splitKeys) {
            if (matchTree(template[key], ast[childKey], isSplitValues)) {
              match = true;
              break;
            }
          }
          if (!match) {
            return false;
          }
        } else {
          if (!matchTree(template[key], ast[realKey], isSplitValues)) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

module.exports = {
  create(context) {
    return {
      CallExpression(node) {
        if (
          matchTree(
            {
              // ctx.cookies.get('u'), ctx.cookies.get('access_token')
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: {
                  type: 'MemberExpression',
                  object: {
                    name: 'ctx',
                  },
                  property: {
                    name: 'cookies',
                  },
                },
                property: {
                  name: 'get',
                },
              },
              arguments: [
                {
                  '[]value': ['u', 'access_token'],
                },
              ],
            },
            node
          )
        ) {
          context.report({
            node: node,
            message:
              '为保证安全，请不要手动从cookies中取auth信息，fetchJson和request-new会自动处理鉴权相关逻辑。如必要，请从`ctx.session`上获取',
          });
        }
      },
      MemberExpression(node) {
        if (
          matchTree(
            {
              type: 'MemberExpression',
              // req.cookies, ctx.cookies
              object: {
                type: 'MemberExpression',
                object: {
                  '[]name': ['req', 'ctx'],
                },
                property: {
                  name: 'cookies',
                },
              },
              // object.u, object.access_token, object['u'], object['access_token']
              property: {
                '[][value,name]': ['u', 'access_token'],
              },
            },
            node
          )
        ) {
          context.report({
            node: node,
            message:
              '为保证安全，请不要手动从cookies中取auth信息，fetchJson和request-new会自动处理鉴权相关逻辑。如必要，请从`ctx.session`上获取',
          });
        }
      },
    };
  },
};
