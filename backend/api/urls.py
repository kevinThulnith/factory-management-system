from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register(r"machines", views.MachineViewSet)

urlpatterns = [
    path("", include(router.urls)),
    # TODO: Add department urls
    path("department/", views.DepartmentCreateView.as_view(), name="department-lc"),
    path(
        "department/<int:pk>/",
        views.DepartmentDetailView.as_view(),
        name="department-rud",
    ),
    # TODO: Add workshop urls
    path("workshop/", views.WorkshopCreateView.as_view(), name="workshop-lc"),
    path(
        "workshop/<int:pk>/",
        views.WorkshopDetailView.as_view(),
        name="workshop-rud",
    ),
    # TODO: Add machine urls
    path("machine/", views.MachineCreateView.as_view(), name="machine-lc"),
    path(
        "machine/<int:pk>/",
        views.MachineDetailView.as_view(),
        name="machine-rud",
    ),
    # TODO: Add supplier urls
    path("supplier/", views.SupplierCreateView.as_view(), name="supplier-lc"),
    path(
        "supplier/<int:pk>/",
        views.SupplierDetailView.as_view(),
        name="supplier-rud",
    ),
    # TODO: Add material urls
    path("material/", views.MaterialCreateView.as_view(), name="material-lc"),
    path(
        "material/<int:pk>/",
        views.MaterialDetailView.as_view(),
        name="material-rud",
    ),
    # TODO: Add order urls
    path("order/", views.OrderCreateView.as_view(), name="order-lc"),
    path(
        "order/<int:pk>/",
        views.OrderDetailView.as_view(),
        name="order-rud",
    ),
    # TODO: Add order material urls
    path("order/item/", views.OrderMaterialCreateView.as_view(), name="order-lc"),
    path(
        "order/item/<int:pk>/",
        views.OrderMaterialDetailView.as_view(),
        name="order-rud",
    ),
    # TODO: Add production line urls
    path("production/", views.ProductionLineCreateView.as_view(), name="production-lc"),
    path(
        "production/<int:pk>/",
        views.ProductionLineDetailView.as_view(),
        name="production-rud",
    ),
    # TODO: Add manufacturing process urls
    path(
        "manufacturing-process/",
        views.ManufacturingProcessCreateView.as_view(),
        name="manufacturing-process-lc",
    ),
    path(
        "manufacturing-process/<int:pk>/",
        views.ManufacturingProcessDetailView.as_view(),
        name="manufacturing-process-rud",
    ),
    # TODO: Add production schedule urls
    path(
        "production-schedule/",
        views.ProductionScheduleCreateView.as_view(),
        name="production-schedule-lc",
    ),
    path(
        "production-schedule/<int:pk>/",
        views.ProductionScheduleDetailView.as_view(),
        name="production-schedule-rud",
    ),
    # TODO: Add product urls
    path("product/", views.ProductCreateView.as_view(), name="product-lc"),
    path(
        "product/<int:pk>/",
        views.ProductDetailView.as_view(),
        name="product-rud",
    ),
    # TODO: Add product process urls
    path(
        "product-process/",
        views.ProductProcessCreateView.as_view(),
        name="product-process-lc",
    ),
    path(
        "product-process/<int:pk>/",
        views.ProductProcessDetailView.as_view(),
        name="product-process-rud",
    ),
    # TODO: Add project urls
    path("project/", views.ProjectCreateView.as_view(), name="project-lc"),
    path(
        "project/<int:pk>/",
        views.ProjectDetailView.as_view(),
        name="project-rud",
    ),
    # TODO: Add task urls
    path("task/", views.TaskCreateView.as_view(), name="task-lc"),
    path(
        "task/<int:pk>/",
        views.TaskDetailView.as_view(),
        name="task-rud",
    ),
    # TODO: Add labor allocation urls
    path(
        "labor-allocation/",
        views.LaborAllocationCreateView.as_view(),
        name="labor-allocation-lc",
    ),
    path(
        "labor-allocation/<int:pk>/",
        views.LaborAllocationDetailView.as_view(),
        name="labor-allocation-rud",
    ),
    # TODO: Add skill matrix urls
    path(
        "skill-matrix/",
        views.SkillMatrixCreateView.as_view(),
        name="skill-matrix-lc",
    ),
    path(
        "skill-matrix/<int:pk>/",
        views.SkillMatrixDetailView.as_view(),
        name="skill-matrix-rud",
    ),
]
