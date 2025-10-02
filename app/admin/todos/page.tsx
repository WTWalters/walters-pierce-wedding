'use client'

import { useState } from 'react'

interface Todo {
  id: string
  title: string
  description?: string
  completed: boolean
  dueDate?: string
  createdAt: string
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([
    {
      id: '1',
      title: 'Finalize venue details',
      description: 'Confirm ceremony and reception venue addresses',
      completed: false,
      dueDate: '2025-09-01',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Create save-the-date design',
      description: 'Design and approve save-the-date cards for September 2025 send',
      completed: false,
      dueDate: '2025-08-15',
      createdAt: new Date().toISOString()
    }
  ])
  const [newTodo, setNewTodo] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const addTodo = () => {
    if (!newTodo.trim()) return
    
    const todo: Todo = {
      id: Date.now().toString(),
      title: newTodo,
      completed: false,
      createdAt: new Date().toISOString()
    }
    
    setTodos([...todos, todo])
    setNewTodo('')
    setShowAddForm(false)
  }

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Wedding To-Do List</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          Add Task
        </button>
      </div>

      {/* Add Todo Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Add New Task</h3>
          <div className="flex space-x-3">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Enter task description..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            />
            <button
              onClick={addTodo}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Todo List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Tasks</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {todos.map((todo) => (
            <div key={todo.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <div className={todo.completed ? 'line-through text-gray-500' : ''}>
                  <h4 className="font-medium">{todo.title}</h4>
                  {todo.description && (
                    <p className="text-sm text-gray-600">{todo.description}</p>
                  )}
                  {todo.dueDate && (
                    <p className="text-xs text-gray-500">Due: {todo.dueDate}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
          
          {todos.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              <p>No tasks yet. Add your first wedding planning task!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}