import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualTree, { type TreeNode } from '../components/VirtualTree.vue'

type Data = { label: string }

const nodes: TreeNode<Data>[] = [
  {
    id: 1,
    data: { label: 'Root 1' },
    children: [
      { id: 2, data: { label: 'Child 1.1' } },
      { id: 3, data: { label: 'Child 1.2' } },
    ],
  },
  { id: 4, data: { label: 'Root 2' } },
]

describe('VirtualTree ARIA', () => {
  it('renders role="tree" on the container, role="treeitem" on rows, with no nested list/listitem', async () => {
    const wrapper = mount(VirtualTree, { props: { nodes } })
    await nextTick()

    expect(wrapper.find('.vvsk-list').attributes('role')).toBe('tree')
    expect(wrapper.findAll('[role="treeitem"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.find('[role="listitem"]').exists()).toBe(false)
  })

  it('sets aria-expanded/aria-level on tree rows', async () => {
    const wrapper = mount(VirtualTree, { props: { nodes } })
    await nextTick()

    const root = wrapper.findAll('[role="treeitem"]')[0]
    expect(root.attributes('aria-level')).toBe('1')
    expect(root.attributes('aria-expanded')).toBe('false')
  })
})
