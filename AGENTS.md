# site

A Kurt application: an MVC web framework on iyi (https://iyi.dev), over
iyi-web (HTTP, routing, templates, sessions, CSRF) and db (SQL, pools).

## Layout

No .iyi file here has a module header or imports. `kurt dev` and `kurt test`
compile them into modules under .kurt/build/ (generated: never edit it), adding the
imports each kind needs; errors still point at these files.

- `config/application.iyi`: runs at start. Middleware: method override, session cookie, CSRF.
- `config/routes.iyi`: `root HomeController, :index`, `resources "posts", PostsController`
  (the REST routes for the actions the controller defines), `get "/about", PagesController, :about`.
  A block nests resources (`/posts/:post_id/comments`); `namespace "admin" do ... end` prefixes paths.
  `kurt routes` prints every route.
- `app/models/<model>.iyi`: `class Post < ApplicationRecord`, one per file.
- `app/controllers/<plural>_controller.iyi`: `class PostsController < ApplicationController`.
- `app/views/<plural>/<action>.eiy`: templates. `<%= expr %>` escapes; `raw(x)` does not.
- `db/migrations/<timestamp>_<name>.sql`: `-- up` and `-- down` sections of plain SQL.
- `test/<name>_test.iyi`: tests through the routes (`dispatch(RouteHandler.new(routes), ...)`).
- A file that needs another module adds its own `import` line at the top.

## Commands

- `kurt dev [-p PORT]`: run the server (http://localhost:3000). It watches app/, config/ and
  db/schema.json: a change is rebuilt and the server restarted, and open pages reload themselves.
  A change that does not build prints iyi's errors and leaves the last good server running.
- `kurt generate scaffold Post title:string body:text user:references published:bool`
- `kurt generate model Comment body:text post:references`
- `kurt generate controller Pages about contact`
- `kurt generate migration add_slug_to_posts`
- `kurt db:migrate`, `kurt db:rollback [STEPS]`, `kurt db:status`, `kurt db:reset` (then seeds)
- `kurt db:seed`: run db/seeds.iyi (models, `find_or_create_by`, `!` works there).
- `kurt test`: migrate a fresh test database and run every test/*_test.iyi. Each test file
  starts with test/fixtures/<table>.yml loaded (`ada:` then `column: value` lines; `user: ada`
  sets user_id, `password:` sets password_digest) and reads a row as `users(:ada)`.
  `sign_in_as(users(:ada))` signs the next requests in. `!` does not work at a test's top
  level: use `.as(User)`.
- `kurt build`: a release binary in bin/site, migrations inside. On the server:
  `KURT_ENV=production DATABASE_URL=... SESSION_SECRET=... ./bin/site db:migrate`, then
  `./bin/site -p 8080`. Production refuses to start without a SESSION_SECRET of 32+ bytes;
  GET /up is the health check.
- `kurt export [-o DIR] [PATH...]`: the application as static files in dist/ (or DIR): every
  GET route without parameters, the local pages they link to, each PATH, and public/. For a
  site with no server: GitHub Pages, Netlify, any web server.

Field types: string, text, int, float, bool, time, references.

## Models

A model's fields come from its table: `kurt db:migrate` writes db/schema.json, and the build
declares a `property` per column (nilable when the column allows NULL). The comment at the top
of each model file lists them. A `property` the model writes itself wins over the schema's.

```iyi
class Post < ApplicationRecord
  belongs_to user : User
  has_many comments : Comment

  def validate(errors : Errors) : Nil
    errors.add("title", "can't be blank") if title.strip.empty?
  end
end
```

- `Post.all`, `Post.find(id)` (NotFound when missing), `Post.find?(id)` (nil), `Post.first`, `Post.first?`, `Post.count`
- `Post.where(published: true).order_desc(:id).paginate(page, per: 20).all`
- one typed finder per field: `Post.title("Hello").first?`
- `Post.includes(:user, :comments).all` loads associations with the rows (no N+1);
  `post.user` and `post.comments` then ask nothing more
- `Post.create(title: "Hi")`, `post.save`, `post.destroy`, `post.increment(:comments_count)`
- every call answers a value or an error (`Post | NotFound | DBError`, `Post | Invalid | DBError`);
  `!` hands the error up.

## Controllers

- `render "posts/index"` renders app/views/posts/index.eiy in layouts/application.eiy
  (`layout: "admin"`, `layout: false`). A template renders a partial with `render "_form.eiy"`.
- An action calls models with `!`. The framework answers NotFound with 404, Invalid with 422,
  Unauthorized with a redirect to /login (401 for JSON), Forbidden with 403, DBError with 503.
- Strong parameters: forms send `post[title]`, and
  `params.require(:post).permit(:title, :body)` is the only way to the Hash a model takes
  (`Post.new(h)`, `post.update(h)`, `Post.create(h)`); values are converted to the field types,
  and one that does not convert ("abc" for a number) is a validation error.
- Saving: `if post.save! ... else render "posts/edit", status: 422 end`. `save`
  answers false when validation fails and keeps the reasons in `post.errors`; its `!` hands a
  DBError up. `post.update(title: "New")` sets fields and saves. `Post.create(...)!` answers the
  record, or hands Invalid up (422).
- `params[:id]` ("" when missing), `params[:q]?` (nil when missing); `Post.find(params[:id])`
  and `paginate(params[:page]?)` take the text as it is (not a number: 404 / page 1).
- `redirect_to path, notice: "..."`, `flash("alert", "...")`, `path_to(record)`, `json(data)`,
  `wants_json?`, `session`.
- `before_action :require_login, except: [:index, :show]`; a filter stops the action by
  answering Unauthorized, Forbidden, NotFound or DBError (a Halt); any other answer runs it.
- Scaffolds load the record in a filter:
  `before_action :set_post, only: [:show, :edit, :update, :destroy]` with
  `private def set_post; @post = Post.find(params[:id])!; end`.
- `@post` and `@posts` need no declaration: in a controller, a variable named after a model
  holds that model (starting as a blank one) and its plural an Array of it (starting empty), so
  neither is ever nil. Any other instance variable is declared with its type:
  `@featured : Array(Post) = [] of Post`. Views read them as they are.
- Views see the action's locals and the controller's methods; forms print `<%= raw(csrf_field) %>`.
